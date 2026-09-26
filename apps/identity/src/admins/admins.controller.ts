import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { AdminPatterns, type AdminCreatePayload, type AdminUpdatePayload, type AdminView } from '@turath/contracts';
import { AdminsService } from './admins.service.js';

/** RabbitMQ handlers for back-office accounts. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @MessagePattern(AdminPatterns.CREATE)
  create(@Payload() payload: AdminCreatePayload): Promise<AdminView> {
    return this.admins.create(payload);
  }

  @MessagePattern(AdminPatterns.LIST)
  list(): Promise<AdminView[]> {
    return this.admins.list();
  }

  @MessagePattern(AdminPatterns.GET)
  get(@Payload() { id }: { id: string }): Promise<AdminView> {
    return this.admins.get(id);
  }

  @MessagePattern(AdminPatterns.UPDATE)
  update(@Payload() payload: AdminUpdatePayload): Promise<AdminView> {
    return this.admins.update(payload);
  }

  @MessagePattern(AdminPatterns.DELETE)
  async delete(@Payload() { id }: { id: string }): Promise<{ deleted: true }> {
    await this.admins.delete(id);
    return { deleted: true };
  }
}
