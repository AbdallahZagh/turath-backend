import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminDisputesController } from './admin-disputes.controller.js';

/** Disputes page and drawer for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminDisputesController], providers: [ApiKeyGuard] })
export class AdminDisputesModule {}
