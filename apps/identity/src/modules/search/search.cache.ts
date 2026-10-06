import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/**
 * Cache of search results, one entry per distinct search. The index itself is kept right by
 * database triggers, so whoever writes a source table is already covered; this cache only needs
 * `invalidate()` from writers the app owns (heritage sites, the categories and regions lists), and
 * for any other change it simply expires after a minute.
 */
@Injectable()
export class SearchCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'search');
  }
}
