import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IDENTITY_CLIENT, type UserRole } from '@turath/contracts';
import { REDIS_CLIENT, type RedisClient, SessionStore } from '@turath/redis';
import { FakeClientProxy } from '@turath/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';

export type GatewayHarness = {
  app: NestExpressApplication;
  /** Scripted identity service: `identity.reply(pattern, fn)` / `identity.fail(pattern, code)`. */
  identity: FakeClientProxy;
  http: () => ReturnType<typeof request>;
  /** Clears rate-limit counters, sessions and cached responses between tests. */
  reset: () => Promise<void>;
  /** A real session + access token, as if the user had just signed in. */
  signIn: (role?: UserRole) => Promise<{ token: string; userId: string; sessionId: string }>;
  close: () => Promise<void>;
};

/**
 * The real gateway (AppModule + the same HTTP setup as main.ts) with the
 * identity RabbitMQ client swapped for a fake. Uses Redis database 15, so
 * `npm run docker:infra` (or any local Redis) must be running.
 */
export async function createGateway(): Promise<GatewayHarness> {
  const identity = new FakeClientProxy();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(IDENTITY_CLIENT)
    .useValue(identity)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  await app.init();

  const redis = app.get<RedisClient>(REDIS_CLIENT);
  const sessions = app.get(SessionStore);
  const jwt = app.get(JwtService);

  return {
    app,
    identity,
    http: () => request(app.getHttpServer()),
    reset: async () => {
      identity.reset();
      await redis.flushDb();
    },
    signIn: async (role = 'TOURIST') => {
      const userId = '11111111-1111-4111-8111-111111111111';
      const { sessionId } = await sessions.create(userId, role, { ip: '127.0.0.1', userAgent: 'vitest' });
      const token = await jwt.signAsync({ sub: userId, role, sid: sessionId }, { expiresIn: 900 });
      return { token, userId, sessionId };
    },
    close: () => app.close(),
  };
}

/** All Set-Cookie headers of a response, joined, for regex assertions. */
export function cookiesOf(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? '');
}
