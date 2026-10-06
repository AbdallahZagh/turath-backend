import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { rpcError, slugify } from '@turath/common';
import {
  IdentityError,
  TAXONOMY_MAX_TERMS_PER_KIND,
  TAXONOMY_SLUG_MAX_LENGTH,
  type AdminTaxonomyCreatePayload,
  type AdminTaxonomyDeletePayload,
  type AdminTaxonomyListPayload,
  type AdminTaxonomyMovePayload,
  type AdminTaxonomyTerm,
  type AdminTaxonomyUpdatePayload,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Prisma, type TaxonomyKind as DbKind } from '../../generated/prisma/client.js';
import { AdminFeaturedCache } from '../admin-featured/admin-featured.cache.js';
import { AdminTaxonomyCache } from './admin-taxonomy.cache.js';
import { toAdminTaxonomyTerm, toApiKind, toDbKind } from './taxonomy.mapper.js';

type Tx = Prisma.TransactionClient;

/** Lists in the order the page shows them, then each list by its position. */
const ORDER: Prisma.TaxonomyTermOrderByWithRelationInput[] = [
  { kind: 'asc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** The slug of a term: what was typed, or the English name when that is empty; `term-<id>` when neither has Latin letters or digits. */
const slugOf = (slug: string | undefined, nameEn: string, id: string) =>
  slugify(slug || nameEn, `term-${id.slice(0, 8)}`, TAXONOMY_SLUG_MAX_LENGTH);

/**
 * Categories, amenities and regions for the admin dashboard. Every write to a list takes a
 * database lock on that list first, so two admins adding, moving or deleting at once cannot
 * produce the same position twice.
 */
@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminTaxonomyCache,
    private readonly featuredCache: AdminFeaturedCache,
  ) {}

  /** The terms of every list (or of one `kind`), each list in its order. */
  list({ kind }: AdminTaxonomyListPayload): Promise<AdminTaxonomyTerm[]> {
    return this.cache.remember(`list:${kind ?? 'all'}`, () => this.read(kind));
  }

  /** Adds a term at the end of its list. */
  async create({ input }: AdminTaxonomyCreatePayload): Promise<AdminTaxonomyTerm> {
    const id = randomUUID();
    const kind = toDbKind(input.kind);

    const term = await this.write(async (tx) => {
      await this.lock(tx, kind);
      if ((await tx.taxonomyTerm.count({ where: { kind } })) >= TAXONOMY_MAX_TERMS_PER_KIND) {
        throw rpcError(IdentityError.TAXONOMY_LIMIT_REACHED, { max: TAXONOMY_MAX_TERMS_PER_KIND });
      }
      const slug = slugOf(input.slug, input.name.en, id);
      await this.assertSlugFree(tx, kind, slug);
      const last = await tx.taxonomyTerm.aggregate({ where: { kind }, _max: { sortOrder: true } });
      return tx.taxonomyTerm.create({
        data: {
          id,
          kind,
          slug,
          nameEn: input.name.en,
          nameAr: input.name.ar,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
      });
    });
    return toAdminTaxonomyTerm(term);
  }

  /** Changes the name and slug of a term. Its list and its position stay. */
  async update({ id, input }: AdminTaxonomyUpdatePayload): Promise<AdminTaxonomyTerm> {
    const term = await this.write(async (tx) => {
      const current = await tx.taxonomyTerm.findUnique({ where: { id } });
      if (!current) throw rpcError(IdentityError.TAXONOMY_TERM_NOT_FOUND);
      if (toApiKind(current.kind) !== input.kind) throw rpcError(IdentityError.TAXONOMY_KIND_MISMATCH);

      await this.lock(tx, current.kind);
      const slug = slugOf(input.slug, input.name.en, id);
      await this.assertSlugFree(tx, current.kind, slug, id);
      return tx.taxonomyTerm.update({ where: { id }, data: { slug, nameEn: input.name.en, nameAr: input.name.ar } });
    });
    return toAdminTaxonomyTerm(term);
  }

  /**
   * Swaps a term with the one above (`-1`) or below (`1`) it in its list and returns every list.
   * A term already at that end stays where it is. The list is renumbered 1, 2, 3… each time.
   */
  async move({ id, direction }: AdminTaxonomyMovePayload): Promise<AdminTaxonomyTerm[]> {
    await this.write(async (tx) => {
      const current = await tx.taxonomyTerm.findUnique({ where: { id } });
      if (!current) throw rpcError(IdentityError.TAXONOMY_TERM_NOT_FOUND);

      await this.lock(tx, current.kind);
      const ordered = await tx.taxonomyTerm.findMany({ where: { kind: current.kind }, orderBy: ORDER });
      const index = ordered.findIndex((term) => term.id === id);
      const other = index + direction;
      if (index < 0 || other < 0 || other >= ordered.length) return;

      [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
      await this.renumber(tx, ordered);
    });
    return this.read();
  }

  /** Deletes a term, closes the gap it leaves in its list and returns every list. */
  async delete({ id }: AdminTaxonomyDeletePayload): Promise<AdminTaxonomyTerm[]> {
    await this.write(async (tx) => {
      const current = await tx.taxonomyTerm.findUnique({ where: { id } });
      if (!current) throw rpcError(IdentityError.TAXONOMY_TERM_NOT_FOUND);

      await this.lock(tx, current.kind);
      await tx.taxonomyTerm.delete({ where: { id } });
      await this.renumber(tx, await tx.taxonomyTerm.findMany({ where: { kind: current.kind }, orderBy: ORDER }));
    });
    return this.read();
  }

  private async read(kind?: AdminTaxonomyListPayload['kind']): Promise<AdminTaxonomyTerm[]> {
    const rows = await this.prisma.taxonomyTerm.findMany({
      where: kind ? { kind: toDbKind(kind) } : {},
      orderBy: ORDER,
    });
    return rows.map(toAdminTaxonomyTerm);
  }

  /** Runs a change in one transaction, then drops the cache. A slug clash that slipped past the check is the same error. */
  private async write<T>(change: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      const result = await this.prisma.$transaction(change);
      // Promotions linked to a category show its name from this list.
      await Promise.all([this.cache.invalidate(), this.featuredCache.invalidate()]);
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) throw rpcError(IdentityError.TAXONOMY_SLUG_TAKEN);
      throw error;
    }
  }

  /** Held until the transaction ends: writers to the same list wait for each other. */
  private async lock(tx: Tx, kind: DbKind): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`taxonomy:${kind}`}))`;
  }

  private async assertSlugFree(tx: Tx, kind: DbKind, slug: string, exceptId?: string): Promise<void> {
    const taken = await tx.taxonomyTerm.findUnique({ where: { kind_slug: { kind, slug } } });
    if (taken && taken.id !== exceptId) throw rpcError(IdentityError.TAXONOMY_SLUG_TAKEN);
  }

  /** Gives `terms` the positions 1, 2, 3… in the order given, touching only the rows that change. */
  private async renumber(tx: Tx, terms: { id: string; sortOrder: number }[]): Promise<void> {
    for (const [index, term] of terms.entries()) {
      if (term.sortOrder !== index + 1) {
        await tx.taxonomyTerm.update({ where: { id: term.id }, data: { sortOrder: index + 1 } });
      }
    }
  }
}
