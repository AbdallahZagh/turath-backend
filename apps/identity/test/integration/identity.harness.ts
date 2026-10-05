import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type ErrorDef, isRpcErrorPayload } from '@turath/common';
import { REDIS_CLIENT, type RedisClient } from '@turath/redis';
import { PrismaService } from '../../src/core/prisma/prisma.service.js';
import { IdentityModule } from '../../src/identity.module.js';
import { AdminBookingsHandler } from '../../src/modules/admin-bookings/admin-bookings.handler.js';
import { AdminReviewsHandler } from '../../src/modules/admin-reviews/admin-reviews.handler.js';
import { AdminUsersHandler } from '../../src/modules/admin-users/admin-users.handler.js';
import { AdminsHandler } from '../../src/modules/admins/admins.handler.js';
import { AuthHandler } from '../../src/modules/auth/auth.handler.js';
import { SessionsHandler } from '../../src/modules/sessions/sessions.handler.js';
import { UsersHandler } from '../../src/modules/users/users.handler.js';

export type IdentityHarness = {
  app: INestApplication;
  /** The RabbitMQ handlers, called directly with the same payloads the gateway sends. */
  auth: AuthHandler;
  users: UsersHandler;
  sessions: SessionsHandler;
  admins: AdminsHandler;
  adminUsers: AdminUsersHandler;
  adminReviews: AdminReviewsHandler;
  adminBookings: AdminBookingsHandler;
  prisma: PrismaService;
  redis: RedisClient;
  reset: () => Promise<void>;
  close: () => Promise<void>;
};

/**
 * The real identity module against `turath_identity_test` (migrated by the
 * global setup) and Redis database 15. RabbitMQ isn't involved: handlers are
 * plain methods.
 */
export async function createIdentity(): Promise<IdentityHarness> {
  const moduleRef = await Test.createTestingModule({ imports: [IdentityModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get<RedisClient>(REDIS_CLIENT);

  return {
    app,
    auth: app.get(AuthHandler),
    users: app.get(UsersHandler),
    sessions: app.get(SessionsHandler),
    admins: app.get(AdminsHandler),
    adminUsers: app.get(AdminUsersHandler),
    adminReviews: app.get(AdminReviewsHandler),
    adminBookings: app.get(AdminBookingsHandler),
    prisma,
    redis,
    reset: async () => {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE users, admins, reviews, bookings');
      await redis.flushDb();
    },
    close: () => app.close(),
  };
}

/** Asserts that a handler rejected with the given domain error (same namespace and code). */
export async function expectRpcError(promise: Promise<unknown>, expected: ErrorDef): Promise<void> {
  try {
    await promise;
    expect.unreachable(`expected ${expected.namespace}.${expected.code}`);
  } catch (error) {
    const payload = (error as { getError?: () => unknown }).getError?.() ?? error;
    const actual = isRpcErrorPayload(payload) ? { namespace: payload.namespace, code: payload.code } : error;
    expect(actual).toEqual({ namespace: expected.namespace, code: expected.code });
  }
}
