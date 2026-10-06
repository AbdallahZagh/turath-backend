import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { AdminSettingsPatterns, type AdminSettings } from '@turath/contracts';
import { AdminSettingsService } from './admin-settings.service.js';

/** RabbitMQ handlers for the settings page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminSettingsHandler {
  constructor(private readonly settings: AdminSettingsService) {}

  @MessagePattern(AdminSettingsPatterns.GET)
  get(): Promise<AdminSettings> {
    return this.settings.get();
  }

  @MessagePattern(AdminSettingsPatterns.SAVE)
  save(@Payload() payload: AdminSettings): Promise<AdminSettings> {
    return this.settings.save(payload);
  }
}
