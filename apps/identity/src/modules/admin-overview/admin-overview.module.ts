import { Module } from '@nestjs/common';
import { AdminOverviewCache } from './admin-overview.cache.js';
import { AdminOverviewHandler } from './admin-overview.handler.js';
import { AdminOverviewService } from './admin-overview.service.js';

/** Dashboard home page, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminOverviewHandler], providers: [AdminOverviewService, AdminOverviewCache] })
export class AdminOverviewModule {}
