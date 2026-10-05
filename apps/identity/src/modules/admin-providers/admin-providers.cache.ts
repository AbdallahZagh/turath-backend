import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/**
 * Cache for the businesses table and detail page. The table shows ratings and the
 * detail page shows bookings and reviews, so moderating a review or changing a
 * booking status must also call `invalidate()`.
 */
@Injectable()
export class AdminProvidersCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-providers');
  }
}
