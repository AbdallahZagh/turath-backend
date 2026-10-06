import { slugify } from '@turath/common';

describe('slugify', () => {
  it('joins lower-case letters and digits with single dashes', () => {
    expect(slugify('Live Music', 'x', 80)).toBe('live-music');
    expect(slugify("  Khan As'ad Pasha  ", 'x', 80)).toBe('khan-as-ad-pasha');
    expect(slugify('24/7 Generator', 'x', 80)).toBe('24-7-generator');
    expect(slugify('Wi-Fi!!', 'x', 80)).toBe('wi-fi');
  });

  it('keeps a slug that is already a slug', () => {
    expect(slugify('live-music', 'x', 80)).toBe('live-music');
  });

  it('uses the fallback when nothing Latin is left', () => {
    expect(slugify('موسيقى حية', 'term-1234', 80)).toBe('term-1234');
    expect(slugify('---', 'term-1234', 80)).toBe('term-1234');
    expect(slugify('', 'term-1234', 80)).toBe('term-1234');
  });

  it('cuts to the limit without leaving a dash at the end', () => {
    const slug = slugify(`${'a'.repeat(9)} bbb`, 'x', 10);

    expect(slug).toBe('aaaaaaaaa');
    expect(slugify('a'.repeat(200), 'x', 80)).toHaveLength(80);
  });
});
