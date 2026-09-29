/** Page-based listing shared by every service. `page` starts at 1. */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export type PageQuery = { page: number; limit: number };

export type Page<T> = {
  items: T[];
  page: number;
  limit: number;
  /** Rows matching the query across all pages. */
  total: number;
  /** 0 when there are no rows. */
  totalPages: number;
};

export function toPage<T>(items: T[], total: number, { page, limit }: PageQuery): Page<T> {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Prisma `skip` / `take` for a page. */
export const pageWindow = ({ page, limit }: PageQuery) => ({ skip: (page - 1) * limit, take: limit });
