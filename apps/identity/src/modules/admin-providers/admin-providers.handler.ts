import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminProviderPatterns,
  type AdminProviderDetailView,
  type AdminProviderExport,
  type AdminProviderFilters,
  type AdminProviderGetPayload,
  type AdminProviderListPayload,
  type AdminProviderPage,
} from '@turath/contracts';
import { AdminProvidersService } from './admin-providers.service.js';

/** RabbitMQ handlers for the admin businesses table and detail page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminProvidersHandler {
  constructor(private readonly providers: AdminProvidersService) {}

  @MessagePattern(AdminProviderPatterns.LIST)
  list(@Payload() query: AdminProviderListPayload): Promise<AdminProviderPage> {
    return this.providers.list(query);
  }

  @MessagePattern(AdminProviderPatterns.EXPORT)
  export(@Payload() filters: AdminProviderFilters): Promise<AdminProviderExport> {
    return this.providers.export(filters);
  }

  @MessagePattern(AdminProviderPatterns.GET)
  get(@Payload() { id }: AdminProviderGetPayload): Promise<AdminProviderDetailView> {
    return this.providers.get(id);
  }
}
