import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/**
 * Cache for the landing page search widget. It is not invalidated on purpose: an entry lives for its 60
 * seconds, and a business that is approved or changed, or a room that is booked, shows up within a minute.
 */
@Injectable()
export class DiscoverCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'discover');
  }
}
