import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AdminDisputePatterns,
  type AdminDisputeDetail,
  type AdminDisputeGetPayload,
  type AdminDisputeListPayload,
  type AdminDisputePage,
  type AdminDisputeResolvePayload,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { GetAdminDisputeDocs, ListAdminDisputesDocs, ResolveDisputeDocs } from './admin-disputes.docs.js';
import { ListDisputesQueryDto, ResolveDisputeDto } from './dto/admin-dispute.dto.js';

/**
 * Disputes page and drawer for the admin dashboard, behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-disputes')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminDisputesDocs()
  list(@Query() { page, limit, category, status, search }: ListDisputesQueryDto): Promise<AdminDisputePage> {
    return this.identity.send<AdminDisputePage, AdminDisputeListPayload>(AdminDisputePatterns.LIST, {
      page,
      limit,
      category,
      status,
      search: search || undefined,
    });
  }

  @Get(':id')
  @GetAdminDisputeDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminDisputeDetail> {
    return this.identity.send<AdminDisputeDetail, AdminDisputeGetPayload>(AdminDisputePatterns.GET, { id });
  }

  @Patch(':id/resolve')
  @ResolveDisputeDocs()
  resolve(
    @Param('id', ParseIdPipe) id: string,
    @Body() { status, notes }: ResolveDisputeDto,
  ): Promise<AdminDisputeDetail> {
    return this.identity.send<AdminDisputeDetail, AdminDisputeResolvePayload>(AdminDisputePatterns.RESOLVE, {
      id,
      status,
      notes: { en: notes.en, ar: notes.ar },
    });
  }
}
