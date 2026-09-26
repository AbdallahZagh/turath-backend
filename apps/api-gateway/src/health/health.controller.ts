import { Controller, Get, HttpStatus, Inject, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IdentityPatterns } from '@turath/contracts';
import { REDIS_CLIENT, type RedisClient } from '@turath/redis';
import { Public } from '../auth/auth.decorators.js';
import { IdentityClient } from '../infra/identity.client.js';

type Check = 'up' | 'down';

/** Liveness + dependency check for Docker / load balancers: GET /health */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly identity: IdentityClient,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<{ status: 'ok' | 'degraded'; checks: Record<string, Check> }> {
    const [redis, identity] = await Promise.all([
      this.redis
        .ping()
        .then((): Check => 'up')
        .catch((): Check => 'down'),
      this.identity
        .send(IdentityPatterns.HEALTH, {}, 2000)
        .then((): Check => 'up')
        .catch((): Check => 'down'),
    ]);
    const checks = { redis, identity };
    const ok = Object.values(checks).every((value) => value === 'up');
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', checks };
  }
}
