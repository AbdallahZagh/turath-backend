import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminSettingsController } from './admin-settings.controller.js';

/** Settings page for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminSettingsController], providers: [ApiKeyGuard] })
export class AdminSettingsModule {}
