import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminFeaturedController, LiveFeaturedController } from './featured.controller.js';

/** Home page promotions: the Featured page of the admin dashboard (ADMIN_API_KEYS) and the public live endpoint. */
@Module({ controllers: [AdminFeaturedController, LiveFeaturedController], providers: [ApiKeyGuard] })
export class FeaturedModule {}
