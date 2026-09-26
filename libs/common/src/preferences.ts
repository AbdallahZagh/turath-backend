/**
 * UI preferences shared with the Next.js frontend. Cookie names and values
 * match the frontend: next-intl reads `locale` (i18n/config.ts) and
 * next-themes stores light / dark / system.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'system';

export const LOCALE_COOKIE = 'locale';
export const THEME_COOKIE = 'theme';
export const PREFERENCE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}
