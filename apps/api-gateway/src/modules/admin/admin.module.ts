import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { ApiKeyGuard } from './api-key.guard.js';

/** Private back-office API, protected by ADMIN_API_KEYS and hidden from Swagger. */
@Module({ controllers: [AdminController], providers: [ApiKeyGuard] })
export class AdminModule {}
