import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/** Cache for the categories, amenities and regions lists. Anything else that writes `taxonomy_terms` must call `invalidate()`. */
@Injectable()
export class AdminTaxonomyCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-taxonomy');
  }
}
