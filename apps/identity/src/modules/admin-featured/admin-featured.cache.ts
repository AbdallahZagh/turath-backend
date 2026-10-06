import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/** Cache for the Featured page and the live promotions. Anything else that writes the promotion tables must call `invalidate()`. */
@Injectable()
export class AdminFeaturedCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-featured');
  }
}
