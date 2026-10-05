import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'node:crypto';

const PREFIX = 'admin-bookings';
const VERSION_KEY = `${PREFIX}:version`;
const TTL_MS = 60_000;
const VERSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Redis cache for the bookings table and drawer.
 *
 * Every key carries a version. A write bumps the version, so every cached page
 * and booking is stale at once, and a read that raced the write can only store
 * under the old version, which nobody reads any more. Entries of old versions
 * simply expire after `TTL_MS`.
 *
 * It is best effort: if Redis is down, reads go to the database and writes
 * still succeed. Anything else that writes `bookings` must call `invalidate()`.
 */
@Injectable()
export class AdminBookingsCache {
  private readonly logger = new Logger(AdminBookingsCache.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /** The cached value for `key`, or `load()`'s result (stored for the next call). */
  async remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    const version = await this.version();
    const fullKey = `${PREFIX}:${version}:${key}`;
    const cached = await this.attempt(() => this.cache.get<T>(fullKey));
    if (cached !== undefined && cached !== null) return cached;

    const value = await load();
    await this.attempt(() => this.cache.set(fullKey, value, TTL_MS));
    return value;
  }

  /** Call after any write to `bookings`. */
  async invalidate(): Promise<void> {
    await this.attempt(() => this.cache.set(VERSION_KEY, randomUUID(), VERSION_TTL_MS));
  }

  private async version(): Promise<string> {
    return (await this.attempt(() => this.cache.get<string>(VERSION_KEY))) ?? 'v0';
  }

  private async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(`Cache unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}
