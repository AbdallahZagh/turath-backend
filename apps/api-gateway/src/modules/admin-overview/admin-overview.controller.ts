import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminOverviewPatterns, type AdminOverview, type AdminOverviewPayload } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { GetOverviewDocs } from './admin-overview.docs.js';
import { OverviewQueryDto } from './dto/admin-overview.dto.js';

/**
 * The dashboard home page, behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 */
@ApiTags('admin-overview')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @GetOverviewDocs()
  get(@Query() { days }: OverviewQueryDto): Promise<AdminOverview> {
    return this.identity.send<AdminOverview, AdminOverviewPayload>(AdminOverviewPatterns.GET, { days });
  }
}
