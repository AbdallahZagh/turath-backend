import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminUsersController } from './admin-users.controller.js';

/** Guests for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminUsersController], providers: [ApiKeyGuard] })
export class AdminUsersModule {}
