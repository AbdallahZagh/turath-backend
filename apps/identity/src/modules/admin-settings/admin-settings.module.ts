import { Module } from '@nestjs/common';
import { AdminFeaturedModule } from '../admin-featured/admin-featured.module.js';
import { AdminSettingsHandler } from './admin-settings.handler.js';
import { AdminSettingsService } from './admin-settings.service.js';

/** Settings page, reachable only through the gateway's API-key protected admin routes. Shares the featuring switches with Featured. */
@Module({
  imports: [AdminFeaturedModule],
  controllers: [AdminSettingsHandler],
  providers: [AdminSettingsService],
})
export class AdminSettingsModule {}
