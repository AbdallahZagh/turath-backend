import { Controller, Get, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ErrorCode, RpcAllExceptionsFilter, rpcError } from '@turath/common';
import {
  IdentityPatterns,
  type AuthResult,
  type LoginEmailPayload,
  type OtpDispatch,
  type OtpSendPayload,
  type OtpVerifyPayload,
  type PasswordForgotPayload,
  type PasswordResetPayload,
  type PreferencesUpdatePayload,
  type RegisterPayload,
  type SessionRef,
  type SessionView,
  type UserView,
} from '@turath/contracts';
import { SessionStore } from '@turath/redis';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

/** RabbitMQ handlers. Input is validated by the gateway before it gets here. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class IdentityController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly sessions: SessionStore,
  ) {}

  /** Plain HTTP for the Docker healthcheck; not exposed outside the network. */
  @Get('health')
  httpHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @MessagePattern(IdentityPatterns.HEALTH)
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @MessagePattern(IdentityPatterns.REGISTER)
  register(@Payload() payload: RegisterPayload): Promise<OtpDispatch> {
    return this.auth.register(payload);
  }

  @MessagePattern(IdentityPatterns.LOGIN_EMAIL)
  loginEmail(@Payload() payload: LoginEmailPayload): Promise<AuthResult> {
    return this.auth.loginWithEmail(payload);
  }

  @MessagePattern(IdentityPatterns.OTP_SEND)
  sendOtp(@Payload() payload: OtpSendPayload): Promise<OtpDispatch> {
    return this.auth.sendOtp(payload);
  }

  @MessagePattern(IdentityPatterns.OTP_VERIFY)
  verifyOtp(@Payload() payload: OtpVerifyPayload): Promise<AuthResult> {
    return this.auth.verifyOtp(payload);
  }

  @MessagePattern(IdentityPatterns.LOGOUT)
  async logout(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: boolean }> {
    return { revoked: await this.sessions.revoke(userId, sessionId) };
  }

  /** Signs out every other device; the current session stays. */
  @MessagePattern(IdentityPatterns.LOGOUT_ALL)
  async logoutAll(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: number }> {
    return { revoked: await this.sessions.revokeAll(userId, sessionId) };
  }

  @MessagePattern(IdentityPatterns.SESSIONS_LIST)
  listSessions(@Payload() { userId, sessionId }: SessionRef): Promise<SessionView[]> {
    return this.sessions.list(userId, sessionId);
  }

  @MessagePattern(IdentityPatterns.SESSIONS_REVOKE)
  async revokeSession(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: true }> {
    if (!(await this.sessions.revoke(userId, sessionId))) throw rpcError(ErrorCode.SESSION_NOT_FOUND);
    return { revoked: true };
  }

  @MessagePattern(IdentityPatterns.PASSWORD_FORGOT)
  forgotPassword(@Payload() payload: PasswordForgotPayload): Promise<OtpDispatch> {
    return this.auth.forgotPassword(payload);
  }

  @MessagePattern(IdentityPatterns.PASSWORD_RESET)
  async resetPassword(@Payload() payload: PasswordResetPayload): Promise<{ ok: true }> {
    await this.auth.resetPassword(payload);
    return { ok: true };
  }

  @MessagePattern(IdentityPatterns.ME)
  me(@Payload() { userId }: { userId: string }): Promise<UserView> {
    return this.users.getView(userId);
  }

  @MessagePattern(IdentityPatterns.PREFERENCES_UPDATE)
  updatePreferences(@Payload() { userId, locale, theme }: PreferencesUpdatePayload): Promise<UserView> {
    return this.users.updatePreferences(userId, { locale, theme });
  }
}
