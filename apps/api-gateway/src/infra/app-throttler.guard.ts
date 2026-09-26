import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthedRequest } from '../auth/auth.decorators.js';

/**
 * Signed-in users are limited per account (so a shared café / hotel IP does
 * not throttle everyone behind it); anonymous traffic is limited per IP.
 * Counters live in Redis, so the limits hold across gateway replicas.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as AuthedRequest;
    return request.user ? `user:${request.user.id}` : `ip:${request.ip ?? 'unknown'}`;
  }
}
