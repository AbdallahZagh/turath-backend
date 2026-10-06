import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AdminTaxonomyPatterns,
  type AdminTaxonomyCreatePayload,
  type AdminTaxonomyDeletePayload,
  type AdminTaxonomyListPayload,
  type AdminTaxonomyMovePayload,
  type AdminTaxonomyTerm,
  type AdminTaxonomyUpdatePayload,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import {
  CreateTaxonomyTermDocs,
  DeleteTaxonomyTermDocs,
  ListTaxonomyDocs,
  MoveTaxonomyTermDocs,
  UpdateTaxonomyTermDocs,
} from './admin-taxonomy.docs.js';
import { ListTaxonomyQueryDto, MoveTaxonomyTermDto, SaveTaxonomyTermDto } from './dto/admin-taxonomy.dto.js';

/**
 * The categories, amenities and regions lists (`/admin/lists` in the dashboard) behind `x-api-key`
 * (see ApiKeyGuard). `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * The lists are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-lists')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/lists')
export class AdminTaxonomyController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListTaxonomyDocs()
  list(@Query() { kind }: ListTaxonomyQueryDto): Promise<AdminTaxonomyTerm[]> {
    return this.identity.send<AdminTaxonomyTerm[], AdminTaxonomyListPayload>(AdminTaxonomyPatterns.LIST, { kind });
  }

  @Post()
  @CreateTaxonomyTermDocs()
  create(@Body() { kind, slug, name }: SaveTaxonomyTermDto): Promise<AdminTaxonomyTerm> {
    return this.identity.send<AdminTaxonomyTerm, AdminTaxonomyCreatePayload>(AdminTaxonomyPatterns.CREATE, {
      input: { kind, slug, name: { en: name.en, ar: name.ar } },
    });
  }

  @Put(':id')
  @UpdateTaxonomyTermDocs()
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() { kind, slug, name }: SaveTaxonomyTermDto,
  ): Promise<AdminTaxonomyTerm> {
    return this.identity.send<AdminTaxonomyTerm, AdminTaxonomyUpdatePayload>(AdminTaxonomyPatterns.UPDATE, {
      id,
      input: { kind, slug, name: { en: name.en, ar: name.ar } },
    });
  }

  @Delete(':id')
  @DeleteTaxonomyTermDocs()
  delete(@Param('id', ParseIdPipe) id: string): Promise<AdminTaxonomyTerm[]> {
    return this.identity.send<AdminTaxonomyTerm[], AdminTaxonomyDeletePayload>(AdminTaxonomyPatterns.DELETE, { id });
  }

  @Patch(':id/move')
  @MoveTaxonomyTermDocs()
  move(@Param('id', ParseIdPipe) id: string, @Body() { direction }: MoveTaxonomyTermDto): Promise<AdminTaxonomyTerm[]> {
    return this.identity.send<AdminTaxonomyTerm[], AdminTaxonomyMovePayload>(AdminTaxonomyPatterns.MOVE, {
      id,
      direction,
    });
  }
}
