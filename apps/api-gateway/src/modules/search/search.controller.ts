import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Header, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchPatterns, type SearchPage, type SearchPayload } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { HttpCacheInterceptor } from '../../core/interceptors/http-cache.interceptor.js';
import { SearchQueryDto } from './dto/search.dto.js';
import { SearchDocs } from './search.docs.js';

/**
 * The global search: public, so anyone can search everything that is public. Answers are cached
 * in Redis here (an exact repeat never reaches the identity service), in the identity service
 * (a repeat that missed here never reaches the database), and by browsers and CDNs.
 */
@ApiTags('search')
@RateLimited()
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('search')
@UseInterceptors(HttpCacheInterceptor)
export class SearchController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @CacheTTL(30_000)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  @SearchDocs()
  search(@Query() { q, type, category, governorate, page, limit }: SearchQueryDto): Promise<SearchPage> {
    return this.identity.send<SearchPage, SearchPayload>(SearchPatterns.QUERY, {
      q,
      type,
      category,
      governorate,
      page,
      limit,
    });
  }
}
