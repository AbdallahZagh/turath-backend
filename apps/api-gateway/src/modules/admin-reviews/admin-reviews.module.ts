import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminReviewsController } from './admin-reviews.controller.js';

/** Review moderation for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminReviewsController], providers: [ApiKeyGuard] })
export class AdminReviewsModule {}
