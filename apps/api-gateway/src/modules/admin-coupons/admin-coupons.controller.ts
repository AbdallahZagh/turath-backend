import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import {
  CreateCouponDocs,
  DeleteCouponDocs,
  GetCouponDocs,
  ListCouponsDocs,
  ListCouponTargetsDocs,
  UpdateCouponDocs,
} from './admin-coupons.docs.js';
import { ListCouponsQueryDto, ListCouponTargetsQueryDto, SaveCouponDto } from './dto/admin-coupon.dto.js';

/** Only the fields a code is saved with, as plain objects; a missing limit means none. */
const pick = ({
  title,
  code,
  discountKind,
  discountValue,
  scope,
  scopeId,
  startAt,
  endAt,
  maxRedemptions,
  perGuestCap,
  enabled,
}: SaveCouponDto) => ({
  title: { en: title.en, ar: title.ar },
  code,
  discountKind,
  discountValue,
  scope,
  scopeId: scopeId || null,
  startAt,
  endAt,
  maxRedemptions: maxRedemptions ?? null,
  perGuestCap: perGuestCap ?? null,
  enabled,
});

/**
 * Discount codes (`/admin/discount-codes` in the dashboard) behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-discount-codes')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/discount-codes')
export class AdminCouponsController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListCouponsDocs()
  list(@Query() { page, limit, scope, status, discountKind, search }: ListCouponsQueryDto): Promise<AdminCouponPage> {
    return this.identity.send<AdminCouponPage, AdminCouponListPayload>(AdminCouponPatterns.LIST, {
      page,
      limit,
      scope,
      status,
      discountKind,
      search: search || undefined,
    });
  }

  @Get('targets')
  @ListCouponTargetsDocs()
  targets(@Query() { scope, search, limit }: ListCouponTargetsQueryDto): Promise<CouponTarget[]> {
    return this.identity.send<CouponTarget[], CouponTargetsPayload>(AdminCouponPatterns.TARGETS, {
      scope,
      search: search || undefined,
      limit,
    });
  }

  @Get(':id')
  @GetCouponDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminCoupon> {
    return this.identity.send<AdminCoupon, AdminCouponGetPayload>(AdminCouponPatterns.GET, { id });
  }

  @Post()
  @CreateCouponDocs()
  create(@Body() input: SaveCouponDto): Promise<AdminCoupon> {
    return this.identity.send<AdminCoupon, AdminCouponCreatePayload>(AdminCouponPatterns.CREATE, {
      input: pick(input),
    });
  }

  @Put(':id')
  @UpdateCouponDocs()
  update(@Param('id', ParseIdPipe) id: string, @Body() input: SaveCouponDto): Promise<AdminCoupon> {
    return this.identity.send<AdminCoupon, AdminCouponUpdatePayload>(AdminCouponPatterns.UPDATE, {
      id,
      input: pick(input),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @DeleteCouponDocs()
  async delete(@Param('id', ParseIdPipe) id: string): Promise<void> {
    await this.identity.send<{ id: string }, AdminCouponDeletePayload>(AdminCouponPatterns.DELETE, { id });
  }
}
