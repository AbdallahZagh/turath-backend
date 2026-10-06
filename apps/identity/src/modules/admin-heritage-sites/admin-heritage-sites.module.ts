import { Module } from '@nestjs/common';
import { SupabaseStorage } from '@turath/common';
import { AdminFeaturedModule } from '../admin-featured/admin-featured.module.js';
import { AdminHeritageSitesCache } from './admin-heritage-sites.cache.js';
import { AdminHeritageSitesHandler } from './admin-heritage-sites.handler.js';
import { AdminHeritageSitesService } from './admin-heritage-sites.service.js';

/** Heritage sites table and pages, reachable only through the gateway's API-key protected admin routes. */
@Module({
  imports: [AdminFeaturedModule],
  controllers: [AdminHeritageSitesHandler],
  providers: [AdminHeritageSitesService, AdminHeritageSitesCache, SupabaseStorage],
})
export class AdminHeritageSitesModule {}
