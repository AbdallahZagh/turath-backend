import { Module } from '@nestjs/common';
import { AdminFeaturedCache } from './admin-featured.cache.js';
import { AdminFeaturedHandler } from './admin-featured.handler.js';
import { AdminFeaturedService } from './admin-featured.service.js';

/** Featured promotions: the admin page (API-key protected at the gateway) and the live ones the home page shows. */
@Module({
  controllers: [AdminFeaturedHandler],
  providers: [AdminFeaturedService, AdminFeaturedCache],
  exports: [AdminFeaturedCache],
})
export class AdminFeaturedModule {}
