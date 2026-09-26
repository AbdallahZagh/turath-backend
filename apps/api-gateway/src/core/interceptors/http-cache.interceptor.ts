import { CacheInterceptor } from '@nestjs/cache-manager';
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import type { AuthedRequest } from '../auth/auth.decorators.js';

/**
 * Response cache for public GET endpoints (catalog, attractions, meta…),
 * stored in Redis. The key includes the language because responses are
 * translated. Signed-in requests are never cached, since they may be personalised.
 *
 * Use with `@UseInterceptors(HttpCacheInterceptor)` + `@CacheTTL(ms)`.
 */
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected override trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.method !== 'GET' || req.user) return undefined;
    const lang = I18nContext.current(context)?.lang ?? 'en';
    return `http:${lang}:${req.originalUrl}`;
  }
}
