import { Module } from '@nestjs/common';
import { AdminCouponsModule } from '../admin-coupons/admin-coupons.module.js';
import { AdminProvidersModule } from '../admin-providers/admin-providers.module.js';
import { AdminBookingsCache } from './admin-bookings.cache.js';
import { AdminBookingsHandler } from './admin-bookings.handler.js';
import { AdminBookingsService } from './admin-bookings.service.js';

/** Bookings table and drawer, reachable only through the gateway's API-key protected admin routes. */
@Module({
  imports: [AdminProvidersModule, AdminCouponsModule],
  controllers: [AdminBookingsHandler],
  providers: [AdminBookingsService, AdminBookingsCache],
})
export class AdminBookingsModule {}
