import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminFeePatterns, type AdminFees, type AdminFeesSavePayload } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { GetAdminFeesDocs, SaveAdminFeesDocs } from './admin-fees.docs.js';
import { SaveFeesDto } from './dto/admin-fees.dto.js';

/**
 * Fees page of the admin dashboard (`/admin/fees`) behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * The page is cached in the identity service, which drops the cache on every save.
 */
@ApiTags('admin-fees')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/fees')
export class AdminFeesController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @GetAdminFeesDocs()
  get(): Promise<AdminFees> {
    return this.identity.send<AdminFees, Record<string, never>>(AdminFeePatterns.GET, {});
  }

  @Put()
  @SaveAdminFeesDocs()
  save(@Body() { sypPerUsd, rates }: SaveFeesDto): Promise<AdminFees> {
    return this.identity.send<AdminFees, AdminFeesSavePayload>(AdminFeePatterns.SAVE, {
      sypPerUsd,
      rates: {
        hotels: rates.hotels,
        dining: rates.dining,
        trips: rates.trips,
        events: rates.events,
        guides: rates.guides,
      },
    });
  }
}
