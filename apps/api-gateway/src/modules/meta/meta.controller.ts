import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { I18n, type I18nContext } from 'nestjs-i18n';
import { DEFAULT_LOCALE, DEFAULT_THEME, LOCALES, THEMES } from '@turath/common';
import { ACCOUNT_TYPES, PROVIDER_TYPES } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { HttpCacheInterceptor } from '../../core/interceptors/http-cache.interceptor.js';
import { MetaDto } from './dto/meta.dto.js';
import { MetaDocs } from './meta.docs.js';

/**
 * Static app metadata, and the reference example of a Redis-cached public
 * endpoint (the cache key includes the language).
 */
@ApiTags('meta')
@RateLimited()
@Public()
@Controller('meta')
@UseInterceptors(HttpCacheInterceptor)
export class MetaController {
  @Get()
  @CacheTTL(60 * 60 * 1000)
  @MetaDocs()
  get(@I18n() i18n: I18nContext): MetaDto {
    return {
      appName: i18n.t('common.APP_NAME'),
      locales: LOCALES.map((code) => ({
        code,
        label: i18n.t(`common.LOCALE_${code}`),
        dir: code === 'ar' ? 'rtl' : 'ltr',
      })),
      defaultLocale: DEFAULT_LOCALE,
      themes: THEMES.map((code) => ({ code, label: i18n.t(`common.THEME_${code}`) })),
      defaultTheme: DEFAULT_THEME,
      currencies: ['SYP', 'USD'],
      accountTypes: ACCOUNT_TYPES.map((code) => ({ code, label: i18n.t(`common.ACCOUNT_TYPE_${code}`) })),
      providerTypes: PROVIDER_TYPES.map((code) => ({ code, label: i18n.t(`common.PROVIDER_TYPE_${code}`) })),
    };
  }
}
