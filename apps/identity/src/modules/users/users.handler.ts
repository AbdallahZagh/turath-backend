import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { IdentityPatterns, type PreferencesUpdatePayload, type UserView } from '@turath/contracts';
import { UsersService } from './users.service.js';

/** RabbitMQ handlers for the signed-in user's profile and saved preferences. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class UsersHandler {
  constructor(private readonly users: UsersService) {}

  @MessagePattern(IdentityPatterns.ME)
  profile(@Payload() { userId }: { userId: string }): Promise<UserView> {
    return this.users.getView(userId);
  }

  @MessagePattern(IdentityPatterns.PREFERENCES_UPDATE)
  updatePreferences(@Payload() { userId, locale, theme }: PreferencesUpdatePayload): Promise<UserView> {
    return this.users.updatePreferences(userId, { locale, theme });
  }
}
