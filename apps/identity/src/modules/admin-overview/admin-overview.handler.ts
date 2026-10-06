import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { AdminOverviewPatterns, type AdminOverview, type AdminOverviewPayload } from '@turath/contracts';
import { AdminOverviewService } from './admin-overview.service.js';

/** RabbitMQ handler for the dashboard home page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminOverviewHandler {
  constructor(private readonly overview: AdminOverviewService) {}

  @MessagePattern(AdminOverviewPatterns.GET)
  get(@Payload() payload: AdminOverviewPayload): Promise<AdminOverview> {
    return this.overview.get(payload);
  }
}
