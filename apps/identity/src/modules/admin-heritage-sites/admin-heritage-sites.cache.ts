import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/** Cache for the heritage sites table and page. Anything else that writes `heritage_sites` must call `invalidate()`. */
@Injectable()
export class AdminHeritageSitesCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-heritage-sites');
  }
}
