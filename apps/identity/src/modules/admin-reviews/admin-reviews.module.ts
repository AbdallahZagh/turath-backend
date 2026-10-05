import { Module } from '@nestjs/common';
import { AdminProvidersModule } from '../admin-providers/admin-providers.module.js';
import { AdminReviewsHandler } from './admin-reviews.handler.js';
import { AdminReviewsService } from './admin-reviews.service.js';

/** Review moderation, reachable only through the gateway's API-key protected admin routes. */
@Module({ imports: [AdminProvidersModule], controllers: [AdminReviewsHandler], providers: [AdminReviewsService] })
export class AdminReviewsModule {}
