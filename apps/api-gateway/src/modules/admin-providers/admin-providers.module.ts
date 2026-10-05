import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminProvidersController } from './admin-providers.controller.js';

/** Businesses table, export and detail page for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminProvidersController], providers: [ApiKeyGuard] })
export class AdminProvidersModule {}
