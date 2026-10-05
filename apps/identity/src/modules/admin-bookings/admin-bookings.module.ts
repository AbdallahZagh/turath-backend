import { Module } from '@nestjs/common';
import { AdminBookingsCache } from './admin-bookings.cache.js';
import { AdminBookingsHandler } from './admin-bookings.handler.js';
import { AdminBookingsService } from './admin-bookings.service.js';

/** Bookings table and drawer, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminBookingsHandler], providers: [AdminBookingsService, AdminBookingsCache] })
export class AdminBookingsModule {}
