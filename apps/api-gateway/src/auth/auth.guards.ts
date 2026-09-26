import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { AppException, ErrorCode } from '@turath/common';
import type { AccessTokenClaims, UserRole } from '@turath/contracts';
import { SessionStore } from '@turath/redis';
import { ACCESS_COOKIE } from './auth.cookies.js';
import { type AuthedRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';

function extractToken(req: AuthedRequest): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[ACCESS_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

/**
 * Global guard. Accepts `Authorization: Bearer` (Flutter, API clients) or the
 * HttpOnly `turath_at` cookie (web). Besides the JWT signature it checks the
 * Redis session still exists, so revoked sessions stop working immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch (error) {
      if (isPublic) return true;
      throw new AppException(error instanceof TokenExpiredError ? ErrorCode.SESSION_EXPIRED : ErrorCode.UNAUTHORIZED);
    }

    if (!(await this.sessions.exists(claims.sid))) {
      if (isPublic) return true;
      throw new AppException(ErrorCode.SESSION_EXPIRED);
    }

    req.user = { id: claims.sub, role: claims.role, sessionId: claims.sid };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppException(ErrorCode.UNAUTHORIZED);
    if (!roles.includes(user.role)) throw new AppException(ErrorCode.FORBIDDEN);
    return true;
  }
}
