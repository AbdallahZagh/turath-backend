import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminBookingsController } from './admin-bookings.controller.js';

/** Bookings table and drawer for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminBookingsController], providers: [ApiKeyGuard] })
export class AdminBookingsModule {}
