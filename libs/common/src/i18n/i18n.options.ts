import { join } from 'node:path';
import { AcceptLanguageResolver, CookieResolver, HeaderResolver, QueryResolver, type I18nOptions } from 'nestjs-i18n';
import { DEFAULT_LOCALE, LOCALE_COOKIE } from '../preferences.js';

/**
 * Language resolution order, first match wins:
 *   1. `?lang=ar`             – explicit override (handy in Swagger / links)
 *   2. `locale` cookie         – set by the frontend or PUT /preferences
 *   3. `x-lang` header         – for the Flutter app, which has no cookie jar
 *   4. `Accept-Language`       – browser default
 * Anything unsupported falls back to English.
 */
export function i18nOptions(): I18nOptions {
  return {
    fallbackLanguage: DEFAULT_LOCALE,
    fallbacks: { 'ar-*': 'ar', 'en-*': 'en' },
    loaderOptions: {
      path: process.env.I18N_PATH ?? join(process.cwd(), 'i18n'),
      watch: process.env.NODE_ENV === 'development',
      // i18n/<lang>/errors/<service>.json → errors.<service>.<CODE>
      includeSubfolders: true,
    },
    resolvers: [
      new QueryResolver(['lang']),
      new CookieResolver([LOCALE_COOKIE]),
      new HeaderResolver(['x-lang']),
      AcceptLanguageResolver,
    ],
    logging: false,
  };
}
