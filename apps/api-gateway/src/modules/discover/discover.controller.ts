import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Header, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DiscoverPatterns, type DiscoverOptions, type DiscoverPage, type DiscoverPayload } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { HttpCacheInterceptor } from '../../core/interceptors/http-cache.interceptor.js';
import { DiscoverSearchQueryDto } from './dto/discover.dto.js';
import { DiscoverOptionsDocs, SearchDocs } from './discover.docs.js';

/** Only the fields of the chosen tab, so the other tabs' leftovers never reach (or split the cache of) the service. */
function fieldsOf(q: DiscoverSearchQueryDto): DiscoverPayload {
  const { tab: category, governorate, page, limit } = q;
  const base = { category, governorate, page, limit };
  switch (category) {
    case 'hotels':
      return { ...base, checkIn: q.checkIn, checkOut: q.checkIn ? q.checkOut : undefined, guests: q.guests };
    case 'dining':
      return { ...base, date: q.date, time: q.time, partySize: q.partySize };
    case 'trips':
      return { ...base, date: q.date, seats: q.seats };
    case 'events':
      return { ...base, date: q.date, qty: q.qty };
    case 'guides':
      return { ...base, date: q.date, language: q.language };
  }
}

/**
 * The landing page search widget ("Where to next?") as one endpoint: `tab` plus the widget's fields, public.
 * Answers are cached here, in the identity service and by browsers and CDNs.
 */
@ApiTags('discover')
@RateLimited()
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('discover')
@UseInterceptors(HttpCacheInterceptor)
export class DiscoverController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @CacheTTL(30_000)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  @SearchDocs()
  search(@Query() query: DiscoverSearchQueryDto): Promise<DiscoverPage> {
    return this.identity.send<DiscoverPage, DiscoverPayload>(DiscoverPatterns.SEARCH, fieldsOf(query));
  }

  @Get('options')
  @CacheTTL(30_000)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  @DiscoverOptionsDocs()
  options(): Promise<DiscoverOptions> {
    return this.identity.send<DiscoverOptions, Record<string, never>>(DiscoverPatterns.OPTIONS, {});
  }
}
