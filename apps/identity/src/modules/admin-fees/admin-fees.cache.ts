import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/** Cache for the fees page. Anything else that writes `fee_settings` or `commission_rates` must call `invalidate()`. */
@Injectable()
export class AdminFeesCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-fees');
  }
}
