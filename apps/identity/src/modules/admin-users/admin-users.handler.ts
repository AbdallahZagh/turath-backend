import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { type PageQuery, RpcAllExceptionsFilter } from '@turath/common';
import { AdminUserPatterns, type AdminUserDetailView, type AdminUserPage } from '@turath/contracts';
import { AdminUsersService } from './admin-users.service.js';

/** RabbitMQ handlers for the admin guests list. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminUsersHandler {
  constructor(private readonly users: AdminUsersService) {}

  @MessagePattern(AdminUserPatterns.LIST)
  list(@Payload() query: PageQuery): Promise<AdminUserPage> {
    return this.users.list(query);
  }

  @MessagePattern(AdminUserPatterns.GET)
  get(@Payload() { id }: { id: string }): Promise<AdminUserDetailView> {
    return this.users.get(id);
  }
}
