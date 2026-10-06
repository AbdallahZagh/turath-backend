import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminOverviewController } from './admin-overview.controller.js';

/** The dashboard home page, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminOverviewController], providers: [ApiKeyGuard] })
export class AdminOverviewModule {}
