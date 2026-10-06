import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminCouponPatterns,
  type AdminCoupon,
  type AdminCouponCreatePayload,
  type AdminCouponDeletePayload,
  type AdminCouponGetPayload,
  type AdminCouponListPayload,
  type AdminCouponPage,
  type AdminCouponUpdatePayload,
  type CouponTarget,
  type CouponTargetsPayload,
} from '@turath/contracts';
import { AdminCouponsService } from './admin-coupons.service.js';

/** RabbitMQ handlers for the discount codes page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminCouponsHandler {
  constructor(private readonly coupons: AdminCouponsService) {}

  @MessagePattern(AdminCouponPatterns.LIST)
  list(@Payload() query: AdminCouponListPayload): Promise<AdminCouponPage> {
    return this.coupons.list(query);
  }

  @MessagePattern(AdminCouponPatterns.GET)
  get(@Payload() { id }: AdminCouponGetPayload): Promise<AdminCoupon> {
    return this.coupons.get(id);
  }

  @MessagePattern(AdminCouponPatterns.CREATE)
  create(@Payload() payload: AdminCouponCreatePayload): Promise<AdminCoupon> {
    return this.coupons.create(payload);
  }

  @MessagePattern(AdminCouponPatterns.UPDATE)
  update(@Payload() payload: AdminCouponUpdatePayload): Promise<AdminCoupon> {
    return this.coupons.update(payload);
  }

  @MessagePattern(AdminCouponPatterns.DELETE)
  delete(@Payload() payload: AdminCouponDeletePayload): Promise<{ id: string }> {
    return this.coupons.delete(payload).then(() => ({ id: payload.id }));
  }

  @MessagePattern(AdminCouponPatterns.TARGETS)
  targets(@Payload() query: CouponTargetsPayload): Promise<CouponTarget[]> {
    return this.coupons.targets(query);
  }
}
