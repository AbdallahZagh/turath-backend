import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, SupabaseStorage, toPage } from '@turath/common';
import {
  IdentityError,
  type AdminHeritageSite,
  type AdminHeritageSiteCreatePayload,
  type AdminHeritageSiteDeletePayload,
  type AdminHeritageSiteListPayload,
  type AdminHeritageSitePage,
  type AdminHeritageSiteUpdatePayload,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import { Prisma, type HeritageSite } from '../../generated/prisma/client.js';
import { SearchCache } from '../search/search.cache.js';
import { AdminFeaturedCache } from '../admin-featured/admin-featured.cache.js';
import { AdminHeritageSitesCache } from './admin-heritage-sites.cache.js';
import { slugFromName, toAdminHeritageSite, toDbGovernorate } from './heritage-site.mapper.js';

/** Every filter given must match; `search` matches either name or the slug. */
function where({ governorate, status, search }: AdminHeritageSiteListPayload): Prisma.HeritageSiteWhereInput {
  return {
    ...(governorate && { governorate: toDbGovernorate(governorate) }),
    ...(status && { published: status === 'published' }),
    ...(search && {
      OR: [
        { nameEn: containsInsensitive(search) },
        { nameAr: containsInsensitive(search) },
        { slug: containsInsensitive(search) },
      ],
    }),
  };
}

const listKey = ({ page, limit, governorate, status, search }: AdminHeritageSiteListPayload) =>
  ['list', page, limit, governorate ?? '', status ?? '', search?.toLowerCase() ?? ''].join(':');

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const isMissingRow = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

/** Every image link of a site, cover first. */
const imagesOf = ({ imageSrc, gallery }: Pick<HeritageSite, 'imageSrc' | 'gallery'>) => [imageSrc, ...gallery];

/** After this many clashes on the same slug, a random suffix is used. */
const SLUG_ATTEMPTS = 20;

/** Heritage sites for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminHeritageSitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminHeritageSitesCache,
    private readonly storage: SupabaseStorage,
    private readonly featuredCache: AdminFeaturedCache,
    private readonly searchCache: SearchCache,
  ) {}

  /** One page of sites, newest first. A page past the end is empty, not an error. */
  list(query: AdminHeritageSiteListPayload): Promise<AdminHeritageSitePage> {
    return this.cache.remember(listKey(query), async () => {
      const filter = where(query);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.heritageSite.findMany({
          where: filter,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.heritageSite.count({ where: filter }),
      ]);
      return toPage(rows.map(toAdminHeritageSite), total, query);
    });
  }

  /** One site. An unknown id is HERITAGE_SITE_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminHeritageSite> {
    return this.cache.remember(`item:${id}`, async () => {
      const row = await this.prisma.heritageSite.findUnique({ where: { id } });
      if (!row) throw rpcError(IdentityError.HERITAGE_SITE_NOT_FOUND);
      return toAdminHeritageSite(row);
    });
  }

  /** Creates a site. Its slug comes from the English name; a name already taken gets `-2`, `-3`… */
  async create({ input }: AdminHeritageSiteCreatePayload): Promise<AdminHeritageSite> {
    const id = randomUUID();
    const base = slugFromName(input.name.en, id);

    for (let attempt = 1; ; attempt += 1) {
      const slug = attempt === 1 ? base : attempt <= SLUG_ATTEMPTS ? `${base}-${attempt}` : `${base}-${id.slice(0, 6)}`;
      try {
        const row = await this.prisma.heritageSite.create({
          data: {
            id,
            slug,
            nameEn: input.name.en,
            nameAr: input.name.ar,
            narrativeEn: input.narrative.en,
            narrativeAr: input.narrative.ar,
            governorate: toDbGovernorate(input.governorate),
            imageSrc: input.imageSrc,
            gallery: input.gallery ?? [],
            opensAt: input.opensAt,
            closesAt: input.closesAt,
            entryFeeSyp: input.entryFeeSyp,
            latitude: input.latitude,
            longitude: input.longitude,
            published: input.published,
          },
        });
        await Promise.all([this.cache.invalidate(), this.searchCache.invalidate()]);
        return toAdminHeritageSite(row);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt > SLUG_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * Replaces everything about a site except its id and slug. Images that were on the site and
   * are no longer, and that we stored ourselves, are deleted from the bucket.
   */
  async update({ id, input }: AdminHeritageSiteUpdatePayload): Promise<AdminHeritageSite> {
    const before = await this.prisma.heritageSite.findUnique({ where: { id } });
    if (!before) throw rpcError(IdentityError.HERITAGE_SITE_NOT_FOUND);

    try {
      const row = await this.prisma.heritageSite.update({
        where: { id },
        data: {
          nameEn: input.name.en,
          nameAr: input.name.ar,
          narrativeEn: input.narrative.en,
          narrativeAr: input.narrative.ar,
          governorate: toDbGovernorate(input.governorate),
          imageSrc: input.imageSrc,
          gallery: input.gallery,
          opensAt: input.opensAt,
          closesAt: input.closesAt,
          entryFeeSyp: input.entryFeeSyp,
          latitude: input.latitude,
          longitude: input.longitude,
          published: input.published,
        },
      });
      // Promotions linked to this site show its name and whether it is published.
      await Promise.all([this.cache.invalidate(), this.featuredCache.invalidate(), this.searchCache.invalidate()]);
      await this.removeImages(imagesOf(before).filter((url) => !imagesOf(row).includes(url)));
      return toAdminHeritageSite(row);
    } catch (error) {
      if (isMissingRow(error)) throw rpcError(IdentityError.HERITAGE_SITE_NOT_FOUND);
      throw error;
    }
  }

  /** Deletes a site and the images we stored for it. */
  async delete({ id }: AdminHeritageSiteDeletePayload): Promise<void> {
    try {
      const row = await this.prisma.heritageSite.delete({ where: { id } });
      await Promise.all([this.cache.invalidate(), this.featuredCache.invalidate(), this.searchCache.invalidate()]);
      await this.removeImages(imagesOf(row));
    } catch (error) {
      if (isMissingRow(error)) throw rpcError(IdentityError.HERITAGE_SITE_NOT_FOUND);
      throw error;
    }
  }

  /** Deletes the ones among `urls` that live in our bucket; links to the frontend or elsewhere are left alone. */
  private async removeImages(urls: string[]): Promise<void> {
    const paths = urls
      .map((url) => this.storage.pathFromPublicUrl(url))
      .filter((path): path is string => path !== null);
    await this.storage.remove([...new Set(paths)]);
  }
}
