import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { I18n, I18nContext } from 'nestjs-i18n';
import {
  AdminProviderPatterns,
  type AdminProviderDetailView,
  type AdminProviderExport,
  type AdminProviderFilters,
  type AdminProviderGetPayload,
  type AdminProviderListPayload,
  type AdminProviderPage,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { ExportAdminProvidersDocs, GetAdminProviderDocs, ListAdminProvidersDocs } from './admin-providers.docs.js';
import { ExportProvidersQueryDto, ListProvidersQueryDto } from './dto/admin-provider.dto.js';
import { providerCsv, providerCsvFilename } from './provider-csv.js';

/** The filters both the table and the export take; an empty search means none. */
const filtersOf = ({ status, category, governorate, search }: AdminProviderFilters): AdminProviderFilters => ({
  status,
  category,
  governorate,
  search: search || undefined,
});

/**
 * Businesses table, CSV export and detail page for the admin dashboard, behind
 * `x-api-key` (see ApiKeyGuard). `@Public()` only skips the user JWT check;
 * ApiKeyGuard is the gate. Table and detail responses are cached in the identity service.
 */
@ApiTags('admin-providers')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/providers')
export class AdminProvidersController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminProvidersDocs()
  list(@Query() { page, limit, ...filters }: ListProvidersQueryDto): Promise<AdminProviderPage> {
    return this.identity.send<AdminProviderPage, AdminProviderListPayload>(AdminProviderPatterns.LIST, {
      page,
      limit,
      ...filtersOf(filters),
    });
  }

  /** Declared before `:id` so "export" is never read as an id. */
  @Get('export')
  @ExportAdminProvidersDocs()
  async export(
    @Query() query: ExportProvidersQueryDto,
    @I18n() i18n: I18nContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { items, total, truncated } = await this.identity.send<AdminProviderExport, AdminProviderFilters>(
      AdminProviderPatterns.EXPORT,
      filtersOf(query),
    );
    // Set here, not with @Header(), so a failed export still answers as JSON.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${providerCsvFilename()}"`);
    res.setHeader('X-Export-Total', String(total));
    res.setHeader('X-Export-Truncated', String(truncated));
    return providerCsv(items, (key) => i18n.t(key), i18n.lang);
  }

  @Get(':id')
  @GetAdminProviderDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminProviderDetailView> {
    return this.identity.send<AdminProviderDetailView, AdminProviderGetPayload>(AdminProviderPatterns.GET, { id });
  }
}
