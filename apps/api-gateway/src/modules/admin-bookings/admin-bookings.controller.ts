import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AdminBookingPatterns,
  type AdminBookingDetail,
  type AdminBookingGetPayload,
  type AdminBookingListPayload,
  type AdminBookingPage,
  type AdminBookingStatusPayload,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { GetAdminBookingDocs, ListAdminBookingsDocs, SetBookingStatusDocs } from './admin-bookings.docs.js';
import { ListBookingsQueryDto, SetBookingStatusDto } from './dto/admin-booking.dto.js';

/**
 * Bookings table and drawer for the admin dashboard, behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-bookings')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminBookingsDocs()
  list(@Query() { page, limit, category, status, search }: ListBookingsQueryDto): Promise<AdminBookingPage> {
    return this.identity.send<AdminBookingPage, AdminBookingListPayload>(AdminBookingPatterns.LIST, {
      page,
      limit,
      category,
      status,
      search: search || undefined,
    });
  }

  @Get(':id')
  @GetAdminBookingDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminBookingDetail> {
    return this.identity.send<AdminBookingDetail, AdminBookingGetPayload>(AdminBookingPatterns.GET, { id });
  }

  @Patch(':id/status')
  @SetBookingStatusDocs()
  setStatus(
    @Param('id', ParseIdPipe) id: string,
    @Body() { status }: SetBookingStatusDto,
  ): Promise<AdminBookingDetail> {
    return this.identity.send<AdminBookingDetail, AdminBookingStatusPayload>(AdminBookingPatterns.SET_STATUS, {
      id,
      status,
    });
  }
}
