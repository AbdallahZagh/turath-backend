import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminHeritageSitePatterns,
  type AdminHeritageSite,
  type AdminHeritageSiteCreatePayload,
  type AdminHeritageSiteDeletePayload,
  type AdminHeritageSiteGetPayload,
  type AdminHeritageSiteListPayload,
  type AdminHeritageSitePage,
  type AdminHeritageSiteUpdatePayload,
} from '@turath/contracts';
import { AdminHeritageSitesService } from './admin-heritage-sites.service.js';

/** RabbitMQ handlers for the admin heritage sites. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminHeritageSitesHandler {
  constructor(private readonly sites: AdminHeritageSitesService) {}

  @MessagePattern(AdminHeritageSitePatterns.LIST)
  list(@Payload() query: AdminHeritageSiteListPayload): Promise<AdminHeritageSitePage> {
    return this.sites.list(query);
  }

  @MessagePattern(AdminHeritageSitePatterns.GET)
  get(@Payload() { id }: AdminHeritageSiteGetPayload): Promise<AdminHeritageSite> {
    return this.sites.get(id);
  }

  @MessagePattern(AdminHeritageSitePatterns.CREATE)
  create(@Payload() payload: AdminHeritageSiteCreatePayload): Promise<AdminHeritageSite> {
    return this.sites.create(payload);
  }

  @MessagePattern(AdminHeritageSitePatterns.UPDATE)
  update(@Payload() payload: AdminHeritageSiteUpdatePayload): Promise<AdminHeritageSite> {
    return this.sites.update(payload);
  }

  @MessagePattern(AdminHeritageSitePatterns.DELETE)
  delete(@Payload() payload: AdminHeritageSiteDeletePayload): Promise<{ id: string }> {
    return this.sites.delete(payload).then(() => ({ id: payload.id }));
  }
}
