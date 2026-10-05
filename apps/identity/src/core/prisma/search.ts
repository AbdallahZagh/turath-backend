/** Prisma doesn't escape LIKE wildcards, so `%`, `_` and `\` are escaped to be searched for literally. */
export const containsInsensitive = (search: string) => ({
  contains: search.replace(/[\\%_]/g, '\\$&'),
  mode: 'insensitive' as const,
});
