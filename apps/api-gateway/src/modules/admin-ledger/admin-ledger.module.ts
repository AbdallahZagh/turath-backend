import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminLedgerController } from './admin-ledger.controller.js';

/** Provider accounts table and page for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminLedgerController], providers: [ApiKeyGuard] })
export class AdminLedgerModule {}
