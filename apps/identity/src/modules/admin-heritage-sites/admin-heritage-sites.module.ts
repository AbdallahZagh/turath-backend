import { Module } from '@nestjs/common';
import { SupabaseStorage } from '@turath/common';
import { AdminHeritageSitesCache } from './admin-heritage-sites.cache.js';
import { AdminHeritageSitesHandler } from './admin-heritage-sites.handler.js';
import { AdminHeritageSitesService } from './admin-heritage-sites.service.js';

/** Heritage sites table and pages, reachable only through the gateway's API-key protected admin routes. */
@Module({
  controllers: [AdminHeritageSitesHandler],
  providers: [AdminHeritageSitesService, AdminHeritageSitesCache, SupabaseStorage],
})
export class AdminHeritageSitesModule {}
