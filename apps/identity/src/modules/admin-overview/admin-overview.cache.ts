import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/**
 * Cache for the dashboard home page. Nothing invalidates it on purpose: the numbers are totals over many
 * bookings, so an entry simply lives for its 60 seconds, and a booking, dispute or business change shows
 * up within a minute.
 */
@Injectable()
export class AdminOverviewCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-overview');
  }
}
