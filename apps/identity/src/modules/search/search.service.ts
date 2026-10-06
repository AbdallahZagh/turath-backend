import { Injectable } from '@nestjs/common';
import {
  SEARCH_MAX_DEPTH,
  SEARCH_MAX_WORDS,
  SEARCH_MIN_LENGTH,
  searchHref,
  type BookingCategory,
  type Governorate,
  type SearchPage,
  type SearchPayload,
  type SearchResult,
  type SearchType,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { SearchCache } from './search.cache.js';

type Row = {
  type: 'CATEGORY' | 'REGION' | 'HERITAGE_SITE' | 'PROVIDER';
  ref: string;
  title_en: string;
  title_ar: string;
  summary_en: string | null;
  summary_ar: string | null;
  slug: string | null;
  image_src: string | null;
  category: string | null;
  governorate: string | null;
  score: number;
};

const API_TYPE: Record<Row['type'], SearchType> = {
  CATEGORY: 'category',
  REGION: 'region',
  HERITAGE_SITE: 'heritageSite',
  PROVIDER: 'provider',
};
const DB_TYPE: Record<SearchType, Row['type']> = {
  category: 'CATEGORY',
  region: 'REGION',
  heritageSite: 'HERITAGE_SITE',
  provider: 'PROVIDER',
};

/** A word this short matches too much to be worth looking up on its own. */
const MIN_WORD_LENGTH = 2;
/**
 * Typos are only forgiven in a one-word query of at least this many characters: shorter words are "close"
 * to too many others, and with several words a half-matching title would wrongly slip past "every word
 * must appear".
 */
const TYPO_MIN_LENGTH = 4;
/** How alike a word must be to a word of a title to count as a typo of it (pg_trgm word similarity, 0-1). */
const TYPO_SIMILARITY = 0.5;

const likeEscape = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** The same search again (same words, filters and page) gets the same cache entry. */
const cacheKey = ({ q, type, category, governorate, page, limit }: SearchPayload) =>
  [q.trim().toLowerCase(), type ?? '', category ?? '', governorate ?? '', page, limit].join('|');

const empty = ({ q, page, limit }: SearchPayload): SearchPage => ({
  query: q.trim(),
  items: [],
  page,
  limit,
  hasMore: false,
});

/**
 * The global search, public. Everything it looks at is in one table, `search_documents`, that
 * database triggers keep in step with published heritage sites, approved businesses and the
 * categories and regions lists, in a normal form shared by English and Arabic (see the SQL function
 * `search_normalize`). Searching never touches the source tables.
 *
 * - Every word of the query must appear somewhere in the text (any position, any part of a word),
 *   found through a trigram GIN index, not a scan.
 * - A one-word query of 4+ characters also finds typos of a title ("citadle"), through the same kind of index.
 * - A query of 2 or 3 characters finds titles that start with it, through a b-tree index.
 * - Results are ranked: exact title, title starting with the query, a title word starting with it,
 *   the query inside the title, then the rest; ties go to heritage sites, then businesses.
 * - Repeated searches are answered from Redis without touching the database.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: SearchCache,
  ) {}

  query(payload: SearchPayload): Promise<SearchPage> {
    if ((payload.page - 1) * payload.limit + payload.limit > SEARCH_MAX_DEPTH) return Promise.resolve(empty(payload));
    return this.cache.remember(cacheKey(payload), () => this.run(payload));
  }

  private async run(payload: SearchPayload): Promise<SearchPage> {
    const { page, limit } = payload;

    // The query is normalised by the database itself, so it is looked up in exactly the form it was indexed in.
    const [{ normalized }] = await this.prisma.$queryRaw<{ normalized: string }[]>`
      SELECT search_normalize(${payload.q}) AS normalized`;
    if (normalized.length < SEARCH_MIN_LENGTH) return empty(payload);

    const words = normalized
      .split(' ')
      .filter((word) => word.length >= MIN_WORD_LENGTH)
      .slice(0, SEARCH_MAX_WORDS);
    if (words.length === 0) return empty(payload);

    const rows = await this.find(normalized, words, payload);
    const hasMore = rows.length > limit;
    return {
      query: payload.q.trim(),
      items: rows.slice(0, limit).map(toResult),
      page,
      limit,
      hasMore,
    };
  }

  private async find(
    normalized: string,
    words: string[],
    { type, category, governorate, page, limit }: SearchPayload,
  ): Promise<Row[]> {
    const containing = (column: Prisma.Sql) =>
      Prisma.join(
        words.map((word) => Prisma.sql`${column} LIKE ${`%${likeEscape(word)}%`}`),
        ' AND ',
      );
    const tokensInText = containing(Prisma.sql`text_norm`);
    const tokensInTitle = containing(Prisma.sql`title_norm`);

    // 2-3 characters: titles starting with it. Longer: every word somewhere, or a typo of a title word.
    const wordsMatch =
      normalized.length < 4
        ? Prisma.sql`title_norm LIKE ${`${likeEscape(normalized)}%`}`
        : Prisma.sql`(${tokensInText})`;
    const match =
      words.length === 1 && normalized.length >= TYPO_MIN_LENGTH
        ? Prisma.sql`(${wordsMatch} OR ${normalized} <% title_norm)`
        : wordsMatch;

    const filters = [
      type ? Prisma.sql`AND type = ${DB_TYPE[type]}::"SearchDocType"` : Prisma.empty,
      category ? Prisma.sql`AND category = ${category.toUpperCase()}::"BookingCategory"` : Prisma.empty,
      governorate ? Prisma.sql`AND governorate = ${governorate.toUpperCase()}::"Governorate"` : Prisma.empty,
    ];

    const rank = Prisma.sql`
      CASE
        WHEN title_norm = ${normalized} THEN 100
        WHEN title_norm LIKE ${`${likeEscape(normalized)}%`} THEN 80
        WHEN title_norm LIKE ${`% ${likeEscape(normalized)}%`} THEN 65
        WHEN title_norm LIKE ${`%${likeEscape(normalized)}%`} THEN 50
        ELSE 0
      END
      + CASE WHEN ${tokensInTitle} THEN 25 ELSE 0 END
      + word_similarity(${normalized}, title_norm) * 20
      + CASE type WHEN 'HERITAGE_SITE' THEN 3 WHEN 'PROVIDER' THEN 2 ELSE 1 END`;

    const query = Prisma.sql`
      SELECT type::text AS type, ref, title_en, title_ar, summary_en, summary_ar, slug, image_src,
             category::text AS category, governorate::text AS governorate, (${rank})::float8 AS score
        FROM search_documents
       WHERE ${match} ${Prisma.join(filters, ' ')}
       ORDER BY score DESC, title_en ASC, id ASC
       LIMIT ${limit + 1} OFFSET ${(page - 1) * limit}`;

    // The typo threshold is set for this one search only (SET LOCAL ends with the transaction).
    const [, rows] = await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${TYPO_SIMILARITY}`),
      this.prisma.$queryRaw<Row[]>(query),
    ]);
    return rows;
  }
}

function toResult(row: Row): SearchResult {
  const type = API_TYPE[row.type];
  const category = row.category ? (row.category.toLowerCase() as BookingCategory) : null;
  const base = {
    type,
    id: row.ref,
    slug: row.slug,
    category,
  };
  return {
    ...base,
    name: { en: row.title_en, ar: row.title_ar },
    summary: row.summary_en !== null && row.summary_ar !== null ? { en: row.summary_en, ar: row.summary_ar } : null,
    imageSrc: row.image_src,
    governorate: row.governorate ? (row.governorate.toLowerCase() as Governorate) : null,
    href: searchHref(base),
    score: Math.round(row.score * 100) / 100,
  };
}
