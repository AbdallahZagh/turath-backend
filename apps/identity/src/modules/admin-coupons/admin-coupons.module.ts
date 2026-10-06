import { Module } from '@nestjs/common';
import { AdminCouponsCache } from './admin-coupons.cache.js';
import { AdminCouponsHandler } from './admin-coupons.handler.js';
import { AdminCouponsService } from './admin-coupons.service.js';

/** Discount codes page, reachable only through the gateway's API-key protected admin routes. Exports the cache for bookings. */
@Module({
  controllers: [AdminCouponsHandler],
  providers: [AdminCouponsService, AdminCouponsCache],
  exports: [AdminCouponsCache],
})
export class AdminCouponsModule {}
