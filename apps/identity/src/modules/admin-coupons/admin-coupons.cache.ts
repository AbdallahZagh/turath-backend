import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/**
 * Cache for the discount codes page. The page shows how many bookings used each code, so a change
 * in a booking's status must also call `invalidate()`.
 */
@Injectable()
export class AdminCouponsCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-coupons');
  }
}
