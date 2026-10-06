/**
 * URL-safe slug: lower-case Latin letters and digits joined by single dashes, cut to `maxLength`.
 * Text with none of those (e.g. only Arabic) gives `fallback`.
 */
export function slugify(text: string, fallback: string, maxLength: number): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : fallback;
}
