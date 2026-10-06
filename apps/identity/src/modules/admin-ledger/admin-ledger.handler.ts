import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminLedgerPatterns,
  type AdminLedgerDetail,
  type AdminLedgerGetPayload,
  type AdminLedgerListPayload,
  type AdminLedgerPage,
} from '@turath/contracts';
import { AdminLedgerService } from './admin-ledger.service.js';

/** RabbitMQ handlers for the admin accounts table and page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminLedgerHandler {
  constructor(private readonly ledger: AdminLedgerService) {}

  @MessagePattern(AdminLedgerPatterns.LIST)
  list(@Payload() query: AdminLedgerListPayload): Promise<AdminLedgerPage> {
    return this.ledger.list(query);
  }

  @MessagePattern(AdminLedgerPatterns.GET)
  get(@Payload() { id }: AdminLedgerGetPayload): Promise<AdminLedgerDetail> {
    return this.ledger.get(id);
  }
}
