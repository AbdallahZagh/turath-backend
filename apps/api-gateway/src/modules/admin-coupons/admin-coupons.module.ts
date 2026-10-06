import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminCouponsController } from './admin-coupons.controller.js';

/** Discount codes page for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminCouponsController], providers: [ApiKeyGuard] })
export class AdminCouponsModule {}
