import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminFeesController } from './admin-fees.controller.js';

/** Fees page for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminFeesController], providers: [ApiKeyGuard] })
export class AdminFeesModule {}
