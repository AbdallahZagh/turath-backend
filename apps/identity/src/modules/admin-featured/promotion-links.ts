import { BOOKING_CATEGORIES, type BookingCategory, type PromotionLink } from '@turath/contracts';
import type { Promotion } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

type Client = Prisma.TransactionClient | PrismaService;

/** A promotion row with the three columns that say what it links to. */
type Linked = Pick<Promotion, 'id' | 'providerId' | 'heritageSiteId' | 'category'>;

const isBookingCategory = (value: string): value is BookingCategory =>
  (BOOKING_CATEGORIES as readonly string[]).includes(value);

/**
 * The link of every promotion in `rows`, with the name of what it points to, keyed by promotion id.
 * Three small lookups for the whole page, however many promotions it has. A promotion with no link
 * has no entry.
 */
export async function loadLinks(client: Client, rows: Linked[]): Promise<Map<string, PromotionLink>> {
  const providerIds = unique(rows.map((row) => row.providerId));
  const siteIds = unique(rows.map((row) => row.heritageSiteId));
  const categories = unique(rows.map((row) => row.category?.toLowerCase() ?? null));

  const [providers, sites, terms] = await Promise.all([
    providerIds.length
      ? client.provider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, nameEn: true, nameAr: true, status: true },
        })
      : [],
    siteIds.length
      ? client.heritageSite.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, slug: true, nameEn: true, nameAr: true, published: true },
        })
      : [],
    categories.length
      ? client.taxonomyTerm.findMany({
          where: { kind: 'CATEGORIES', slug: { in: categories } },
          select: { slug: true, nameEn: true, nameAr: true },
        })
      : [],
  ]);

  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const termBySlug = new Map(terms.map((term) => [term.slug, term]));

  const links = new Map<string, PromotionLink>();
  for (const row of rows) {
    if (row.providerId) {
      const provider = providerById.get(row.providerId);
      if (provider) {
        links.set(row.id, {
          type: 'provider',
          id: provider.id,
          name: { en: provider.nameEn, ar: provider.nameAr },
          slug: null,
          available: provider.status === 'APPROVED',
        });
      }
    } else if (row.heritageSiteId) {
      const site = siteById.get(row.heritageSiteId);
      if (site) {
        links.set(row.id, {
          type: 'heritageSite',
          id: site.id,
          name: { en: site.nameEn, ar: site.nameAr },
          slug: site.slug,
          available: site.published,
        });
      }
    } else if (row.category) {
      const slug = row.category.toLowerCase();
      const term = termBySlug.get(slug);
      links.set(row.id, {
        type: 'category',
        id: slug,
        // The name comes from the categories list; if that term was deleted there, the id stands in.
        name: { en: term?.nameEn ?? slug, ar: term?.nameAr ?? slug },
        slug,
        available: true,
      });
    }
  }
  return links;
}

function unique<T>(values: (T | null)[]): T[] {
  return [...new Set(values.filter((value): value is T => value !== null))];
}

export { isBookingCategory };
