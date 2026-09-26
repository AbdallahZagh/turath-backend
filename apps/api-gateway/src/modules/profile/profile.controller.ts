import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdentityPatterns, type UserView } from '@turath/contracts';
import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { ProfileDocs } from './profile.docs.js';

/** The signed-in user's own account. */
@ApiTags('profile')
@RateLimited()
@Controller('auth')
export class ProfileController {
  constructor(private readonly identity: IdentityClient) {}

  @Get('profile')
  @ProfileDocs()
  profile(@CurrentUser() user: AuthUser): Promise<UserView> {
    return this.identity.send(IdentityPatterns.ME, { userId: user.id });
  }
}
