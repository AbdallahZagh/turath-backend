import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, AdminPatterns, type AdminView } from '@turath/contracts';
import { Public } from '../auth/auth.decorators.js';
import { IdentityClient } from '../infra/identity.client.js';
import { ParseIdPipe } from '../infra/parse-id.pipe.js';
import { CreateAdminDto, UpdateAdminDto } from './admin.dto.js';
import { ApiKeyGuard } from './api-key.guard.js';

/**
 * Private back-office API: `x-api-key: <one of ADMIN_API_KEYS>`.
 * Not in Swagger, and without a valid key every route answers 404.
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 */
@ApiExcludeController()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin')
export class AdminController {
  constructor(private readonly identity: IdentityClient) {}

  /** Allowed values for `role` and `permissions`. */
  @Get('options')
  options(): { roles: readonly string[]; permissions: readonly string[] } {
    return { roles: ADMIN_ROLES, permissions: ADMIN_PERMISSIONS };
  }

  @Post('admins')
  create(@Body() dto: CreateAdminDto): Promise<AdminView> {
    return this.identity.send(AdminPatterns.CREATE, {
      fullName: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      permissions: dto.permissions,
    });
  }

  @Get('admins')
  list(): Promise<AdminView[]> {
    return this.identity.send(AdminPatterns.LIST, {});
  }

  @Get('admins/:id')
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminView> {
    return this.identity.send(AdminPatterns.GET, { id });
  }

  @Patch('admins/:id')
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateAdminDto): Promise<AdminView> {
    const { name, ...rest } = dto;
    return this.identity.send(AdminPatterns.UPDATE, {
      id,
      ...rest,
      ...(name !== undefined && { fullName: name }),
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('admins/:id')
  async delete(@Param('id', ParseIdPipe) id: string): Promise<void> {
    await this.identity.send(AdminPatterns.DELETE, { id });
  }
}
