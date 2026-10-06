import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AdminLedgerPatterns,
  type AdminLedgerDetail,
  type AdminLedgerGetPayload,
  type AdminLedgerListPayload,
  type AdminLedgerPage,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { GetAdminLedgerDocs, ListAdminLedgerDocs } from './admin-ledger.docs.js';
import { ListLedgerQueryDto } from './dto/admin-ledger.dto.js';

/**
 * Provider accounts (`/admin/accounts` in the dashboard) behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-accounts')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/accounts')
export class AdminLedgerController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminLedgerDocs()
  list(@Query() { page, limit, category, standing, search }: ListLedgerQueryDto): Promise<AdminLedgerPage> {
    return this.identity.send<AdminLedgerPage, AdminLedgerListPayload>(AdminLedgerPatterns.LIST, {
      page,
      limit,
      category,
      standing,
      search: search || undefined,
    });
  }

  @Get(':id')
  @GetAdminLedgerDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminLedgerDetail> {
    return this.identity.send<AdminLedgerDetail, AdminLedgerGetPayload>(AdminLedgerPatterns.GET, { id });
  }
}
