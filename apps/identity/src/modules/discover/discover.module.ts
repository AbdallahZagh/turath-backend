import { Module } from '@nestjs/common';
import { DiscoverCache } from './discover.cache.js';
import { DiscoverHandler } from './discover.handler.js';
import { DiscoverService } from './discover.service.js';

/** The landing page search widget (public). */
@Module({ controllers: [DiscoverHandler], providers: [DiscoverService, DiscoverCache] })
export class DiscoverModule {}
