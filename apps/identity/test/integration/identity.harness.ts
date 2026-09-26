import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { isRpcErrorPayload, type ErrorCode } from '@turath/common';
import { REDIS_CLIENT, type RedisClient } from '@turath/redis';
import { AdminsController } from '../../src/admins/admins.controller.js';
import { IdentityController } from '../../src/auth/identity.controller.js';
import { IdentityModule } from '../../src/identity.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export type IdentityHarness = {
  app: INestApplication;
  /** The RabbitMQ handlers, called directly with the same payloads the gateway sends. */
  identity: IdentityController;
  admins: AdminsController;
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
    identity: app.get(IdentityController),
    admins: app.get(AdminsController),
    prisma,
    redis,
    reset: async () => {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE users, admins');
      await redis.flushDb();
    },
    close: () => app.close(),
  };
}

/** Asserts that a handler rejected with the given domain error code. */
export async function expectRpcError(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  try {
    await promise;
    expect.unreachable(`expected ${code}`);
  } catch (error) {
    const payload = (error as { getError?: () => unknown }).getError?.() ?? error;
    expect(isRpcErrorPayload(payload) ? payload.code : error).toBe(code);
  }
}
