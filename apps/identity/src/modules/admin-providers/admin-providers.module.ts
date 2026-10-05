import { Module } from '@nestjs/common';
import { AdminProvidersCache } from './admin-providers.cache.js';
import { AdminProvidersHandler } from './admin-providers.handler.js';
import { AdminProvidersService } from './admin-providers.service.js';

/**
 * Businesses table and detail page, reachable only through the gateway's API-key
 * protected admin routes. Exports the cache so modules that change what it shows
 * (bookings, reviews) can invalidate it.
 */
@Module({
  controllers: [AdminProvidersHandler],
  providers: [AdminProvidersService, AdminProvidersCache],
  exports: [AdminProvidersCache],
})
export class AdminProvidersModule {}
