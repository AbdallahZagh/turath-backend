import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VersionedCache } from '../../core/cache/versioned-cache.js';

/** Cache for the accounts table and page. Anything else that writes `ledger_accounts` must call `invalidate()`. */
@Injectable()
export class AdminLedgerCache extends VersionedCache {
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    super(cache, 'admin-ledger');
  }
}
