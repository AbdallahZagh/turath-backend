import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppException, CommonError, parseApiKeys } from '@turath/common';

export const API_KEY_HEADER = 'x-api-key';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Protects the private admin API with the keys in ADMIN_API_KEYS.
 * A missing or wrong key gets the same 404 as an unknown route, so the admin
 * routes can't be discovered by probing. Keys are compared as SHA-256 digests
 * with timingSafeEqual (equal length, constant time).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly keys: Buffer[];

  constructor(config: ConfigService) {
    this.keys = parseApiKeys(config.get('ADMIN_API_KEYS')).map(digest);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers[API_KEY_HEADER];

    if (typeof provided === 'string' && provided) {
      const candidate = digest(provided);
      // Check every key (no early exit) so timing doesn't reveal which one matched.
      const matched = this.keys.reduce((ok, key) => timingSafeEqual(key, candidate) || ok, false);
      if (matched) return true;
      this.logger.warn(`rejected admin API key from ${req.ip ?? 'unknown'} on ${req.method} ${req.originalUrl}`);
    }
    throw new AppException(CommonError.NOT_FOUND);
  }
}
