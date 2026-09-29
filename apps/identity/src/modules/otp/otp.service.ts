import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rpcError } from '@turath/common';
import { type AuthChannel, IdentityError } from '@turath/contracts';
import { REDIS_CLIENT, type RedisClient } from '@turath/redis';

/** SRS: at most 3 codes per destination per 15 minutes. */
const WINDOW_LIMIT = 3;
const WINDOW_SECONDS = 15 * 60;

const hash = (value: string) => createHash('sha256').update(value).digest();

/**
 * One-time codes live only in Redis (hashed), with an attempt counter, a
 * resend cooldown and a per-destination window cap.
 *
 *   otp:<channel>:<destination>        HASH codeHash, attempts   (TTL = OTP_TTL_SECONDS)
 *   otp-cooldown:<channel>:<dest>      "1"                        (TTL = resend cooldown)
 *   otp-window:<channel>:<dest>        counter                    (TTL = 15 min)
 */
@Injectable()
export class OtpService {
  readonly ttlSeconds: number;
  readonly cooldownSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(config.get('OTP_TTL_SECONDS') ?? 300);
    this.cooldownSeconds = Number(config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60);
    this.maxAttempts = Number(config.get('OTP_MAX_ATTEMPTS') ?? 5);
  }

  /** Checks rate limits and stores a new code. Throws OTP_COOLDOWN when asked too often. */
  async issue(channel: AuthChannel, destination: string): Promise<string> {
    const id = `${channel}:${destination}`;

    const cooldown = await this.redis.ttl(`otp-cooldown:${id}`);
    if (cooldown > 0) throw rpcError(IdentityError.OTP_COOLDOWN, { seconds: cooldown });

    const sent = await this.redis.incr(`otp-window:${id}`);
    if (sent === 1) await this.redis.expire(`otp-window:${id}`, WINDOW_SECONDS);
    if (sent > WINDOW_LIMIT) {
      const seconds = await this.redis.ttl(`otp-window:${id}`);
      throw rpcError(IdentityError.OTP_COOLDOWN, { seconds: Math.max(seconds, 1) });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis
      .multi()
      .hSet(`otp:${id}`, { codeHash: hash(code).toString('hex'), attempts: '0' })
      .expire(`otp:${id}`, this.ttlSeconds)
      .set(`otp-cooldown:${id}`, '1', { EX: this.cooldownSeconds })
      .exec();
    return code;
  }

  /** Consumes the code on success. Wrong codes count towards OTP_MAX_ATTEMPTS. */
  async verify(channel: AuthChannel, destination: string, code: string): Promise<void> {
    const key = `otp:${channel}:${destination}`;
    const stored = await this.redis.hGetAll(key);
    if (!stored.codeHash) throw rpcError(IdentityError.OTP_EXPIRED);

    if (Number(stored.attempts) >= this.maxAttempts) {
      await this.redis.del(key);
      throw rpcError(IdentityError.OTP_TOO_MANY_ATTEMPTS);
    }

    const matches = timingSafeEqual(Buffer.from(stored.codeHash, 'hex'), hash(code));
    if (!matches) {
      await this.redis.hIncrBy(key, 'attempts', 1);
      throw rpcError(IdentityError.OTP_INVALID);
    }
    await this.redis.del([key, `otp-window:${channel}:${destination}`]);
  }
}
