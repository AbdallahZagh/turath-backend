import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminUserPatterns, type AdminUserDetailView, type AdminUserPage } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { PageQueryDto } from '../../core/dto/page-query.dto.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { GetAdminUserDocs, ListAdminUsersDocs } from './admin-users.docs.js';

/**
 * Guests (tourists) for the admin dashboard, behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Shown in Swagger with the `admin-api-key` scheme.
 */
@ApiTags('admin-users')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminUsersDocs()
  list(@Query() { page, limit }: PageQueryDto): Promise<AdminUserPage> {
    return this.identity.send(AdminUserPatterns.LIST, { page, limit });
  }

  @Get(':id')
  @GetAdminUserDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminUserDetailView> {
    return this.identity.send(AdminUserPatterns.GET, { id });
  }
}
