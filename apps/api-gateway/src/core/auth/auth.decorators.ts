import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@turath/contracts';
import type { Request } from 'express';

export type AuthUser = { id: string; role: UserRole; sessionId: string };
export type AuthedRequest = Request & { user?: AuthUser };

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Route works without a token. If a valid token is sent anyway, `req.user` is still set. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restrict a route to these roles (checked after authentication). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
