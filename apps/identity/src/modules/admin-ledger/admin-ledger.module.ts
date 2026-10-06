import { Module } from '@nestjs/common';
import { AdminLedgerCache } from './admin-ledger.cache.js';
import { AdminLedgerHandler } from './admin-ledger.handler.js';
import { AdminLedgerService } from './admin-ledger.service.js';

/** Provider accounts table and page, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminLedgerHandler], providers: [AdminLedgerService, AdminLedgerCache] })
export class AdminLedgerModule {}
