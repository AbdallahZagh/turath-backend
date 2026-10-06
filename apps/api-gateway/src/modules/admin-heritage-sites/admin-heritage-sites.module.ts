import { Module } from '@nestjs/common';
import { SupabaseStorage } from '@turath/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminHeritageSitesController } from './admin-heritage-sites.controller.js';
import { HeritageImagesService } from './heritage-images.service.js';

/** Heritage sites for the admin dashboard, protected by ADMIN_API_KEYS. Images go to Supabase Storage. */
@Module({
  controllers: [AdminHeritageSitesController],
  providers: [ApiKeyGuard, SupabaseStorage, HeritageImagesService],
})
export class AdminHeritageSitesModule {}
