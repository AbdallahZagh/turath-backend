import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdentityPatterns, type SessionView } from '@turath/contracts';
import { AuthCookies } from '../../core/auth/auth-cookies.js';
import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { RevokedCountDto } from './dto/session.dto.js';
import { ListSessionsDocs, LogoutDocs, LogoutOthersDocs, RevokeSessionDocs } from './sessions.docs.js';

/** Signing out, and the list of devices signed in to the account. */
@ApiTags('sessions')
@RateLimited()
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly identity: IdentityClient,
    private readonly cookies: AuthCookies,
  ) {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @LogoutDocs()
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.identity.send(IdentityPatterns.LOGOUT, { userId: user.id, sessionId: user.sessionId });
    this.cookies.clearSession(res);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout/others')
  @LogoutOthersDocs()
  logoutOthers(@CurrentUser() user: AuthUser): Promise<RevokedCountDto> {
    return this.identity.send(IdentityPatterns.LOGOUT_ALL, { userId: user.id, sessionId: user.sessionId });
  }

  @Get('sessions')
  @ListSessionsDocs()
  list(@CurrentUser() user: AuthUser): Promise<SessionView[]> {
    return this.identity.send(IdentityPatterns.SESSIONS_LIST, { userId: user.id, sessionId: user.sessionId });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  @RevokeSessionDocs()
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) sessionId: string): Promise<void> {
    await this.identity.send(IdentityPatterns.SESSIONS_REVOKE, { userId: user.id, sessionId });
  }
}
