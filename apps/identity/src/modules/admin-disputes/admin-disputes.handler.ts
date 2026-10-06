import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminDisputePatterns,
  type AdminDisputeDetail,
  type AdminDisputeGetPayload,
  type AdminDisputeListPayload,
  type AdminDisputePage,
  type AdminDisputeResolvePayload,
} from '@turath/contracts';
import { AdminDisputesService } from './admin-disputes.service.js';

/** RabbitMQ handlers for the admin disputes page and drawer. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminDisputesHandler {
  constructor(private readonly disputes: AdminDisputesService) {}

  @MessagePattern(AdminDisputePatterns.LIST)
  list(@Payload() query: AdminDisputeListPayload): Promise<AdminDisputePage> {
    return this.disputes.list(query);
  }

  @MessagePattern(AdminDisputePatterns.GET)
  get(@Payload() { id }: AdminDisputeGetPayload): Promise<AdminDisputeDetail> {
    return this.disputes.get(id);
  }

  @MessagePattern(AdminDisputePatterns.RESOLVE)
  resolve(@Payload() payload: AdminDisputeResolvePayload): Promise<AdminDisputeDetail> {
    return this.disputes.resolve(payload);
  }
}
