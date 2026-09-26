import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ErrorCode, RpcAllExceptionsFilter, rpcError } from '@turath/common';
import { IdentityPatterns, type SessionRef, type SessionView } from '@turath/contracts';
import { SessionStore } from '@turath/redis';

/** RabbitMQ handlers for signing out and listing signed-in devices (sessions live in Redis). */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class SessionsHandler {
  constructor(private readonly sessions: SessionStore) {}

  @MessagePattern(IdentityPatterns.LOGOUT)
  async logout(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: boolean }> {
    return { revoked: await this.sessions.revoke(userId, sessionId) };
  }

  /** Signs out every other device; the current session stays. */
  @MessagePattern(IdentityPatterns.LOGOUT_ALL)
  async logoutOthers(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: number }> {
    return { revoked: await this.sessions.revokeAll(userId, sessionId) };
  }

  @MessagePattern(IdentityPatterns.SESSIONS_LIST)
  list(@Payload() { userId, sessionId }: SessionRef): Promise<SessionView[]> {
    return this.sessions.list(userId, sessionId);
  }

  @MessagePattern(IdentityPatterns.SESSIONS_REVOKE)
  async revoke(@Payload() { userId, sessionId }: SessionRef): Promise<{ revoked: true }> {
    if (!(await this.sessions.revoke(userId, sessionId))) throw rpcError(ErrorCode.SESSION_NOT_FOUND);
    return { revoked: true };
  }
}
