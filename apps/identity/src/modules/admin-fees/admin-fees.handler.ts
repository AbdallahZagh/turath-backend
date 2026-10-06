import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { AdminFeePatterns, type AdminFees, type AdminFeesSavePayload } from '@turath/contracts';
import { AdminFeesService } from './admin-fees.service.js';

/** RabbitMQ handlers for the admin fees page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminFeesHandler {
  constructor(private readonly fees: AdminFeesService) {}

  @MessagePattern(AdminFeePatterns.GET)
  get(): Promise<AdminFees> {
    return this.fees.get();
  }

  @MessagePattern(AdminFeePatterns.SAVE)
  save(@Payload() payload: AdminFeesSavePayload): Promise<AdminFees> {
    return this.fees.save(payload);
  }
}
