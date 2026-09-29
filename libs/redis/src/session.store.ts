import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientInfo, SessionView, UserRole } from '@turath/contracts';
import { REDIS_CLIENT, type RedisClient } from './redis.constants.js';

/**
 * Server-side sessions in Redis. Each login creates one session; the refresh
 * token (`<sessionId>.<secret>`) is only ever stored as a SHA-256 hash.
 *
 *   sess:<sid>             HASH  userId, role, secretHash, prevHash, rotatedAt, ip, ua, createdAt, lastUsedAt
 *   user-sessions:<userId> SET   of session ids
 *
 * Access tokens carry `sid`; the gateway checks the session still exists, so
 * logout / "sign out other devices" takes effect immediately rather than
 * after the access token expires.
 */
export type StoredSession = {
  id: string;
  userId: string;
  role: UserRole;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
  lastUsedAt: number;
};

export type IssuedRefresh = { refreshToken: string; expiresAt: Date };

export type RotateResult =
  | { status: 'rotated'; session: StoredSession; refresh: IssuedRefresh }
  | { status: 'invalid' }
  | { status: 'reused' }
  | { status: 'race' };

/** A parallel refresh (two tabs) may present the previous secret for a moment. */
const ROTATION_GRACE_MS = 30_000;

const ROTATE_SCRIPT = `
local cur = redis.call('HGET', KEYS[1], 'secretHash')
if not cur then return 0 end
if cur == ARGV[1] then
  redis.call('HSET', KEYS[1], 'secretHash', ARGV[2], 'prevHash', ARGV[1], 'rotatedAt', ARGV[3], 'lastUsedAt', ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[4])
  return 1
end
local prev = redis.call('HGET', KEYS[1], 'prevHash')
local rotatedAt = tonumber(redis.call('HGET', KEYS[1], 'rotatedAt') or '0')
if prev == ARGV[1] and (tonumber(ARGV[3]) - rotatedAt) < tonumber(ARGV[5]) then return -2 end
return -1
`;

const sessionKey = (sid: string) => `sess:${sid}`;
const userSessionsKey = (userId: string) => `user-sessions:${userId}`;
const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

@Injectable()
export class SessionStore {
  private readonly ttlMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    config: ConfigService,
  ) {
    this.ttlMs = Number(config.get('REFRESH_TTL_DAYS') ?? 30) * 24 * 60 * 60 * 1000;
  }

  async create(
    userId: string,
    role: UserRole,
    client: ClientInfo,
  ): Promise<{ sessionId: string; refresh: IssuedRefresh }> {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const now = Date.now();

    await this.redis
      .multi()
      .hSet(sessionKey(sessionId), {
        userId,
        role,
        secretHash: hashSecret(secret),
        ip: client.ip ?? '',
        ua: (client.userAgent ?? '').slice(0, 300),
        createdAt: String(now),
        lastUsedAt: String(now),
      })
      .pExpire(sessionKey(sessionId), this.ttlMs)
      .sAdd(userSessionsKey(userId), sessionId)
      .pExpire(userSessionsKey(userId), this.ttlMs)
      .exec();

    return { sessionId, refresh: this.issue(sessionId, secret) };
  }

  /** Rotates the refresh secret. Presenting an old secret revokes the session (token theft). */
  async rotate(refreshToken: string): Promise<RotateResult> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return { status: 'invalid' };

    const secret = randomBytes(32).toString('base64url');
    const now = Date.now();
    const result = (await this.redis.eval(ROTATE_SCRIPT, {
      keys: [sessionKey(parsed.sessionId)],
      arguments: [
        hashSecret(parsed.secret),
        hashSecret(secret),
        String(now),
        String(this.ttlMs),
        String(ROTATION_GRACE_MS),
      ],
    })) as number;

    if (result === 0) return { status: 'invalid' };
    if (result === -2) return { status: 'race' };
    if (result === -1) {
      const session = await this.get(parsed.sessionId);
      if (session) await this.revoke(session.userId, session.id);
      return { status: 'reused' };
    }

    const session = await this.get(parsed.sessionId);
    if (!session) return { status: 'invalid' };
    await this.redis.pExpire(userSessionsKey(session.userId), this.ttlMs);
    return { status: 'rotated', session, refresh: this.issue(session.id, secret) };
  }

  async exists(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(sessionKey(sessionId))) === 1;
  }

  async get(sessionId: string): Promise<StoredSession | null> {
    const raw = await this.redis.hGetAll(sessionKey(sessionId));
    if (!raw.userId) return null;
    return {
      id: sessionId,
      userId: raw.userId,
      role: raw.role as UserRole,
      ip: raw.ip || null,
      userAgent: raw.ua || null,
      createdAt: Number(raw.createdAt),
      lastUsedAt: Number(raw.lastUsedAt),
    };
  }

  async list(userId: string, currentSessionId?: string): Promise<SessionView[]> {
    const ids = await this.redis.sMembers(userSessionsKey(userId));
    const sessions = await Promise.all(ids.map((id) => this.get(id)));

    const stale = ids.filter((_, index) => !sessions[index]);
    if (stale.length) await this.redis.sRem(userSessionsKey(userId), stale);

    return sessions
      .filter((session): session is StoredSession => session !== null)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .map((session) => ({
        id: session.id,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: new Date(session.createdAt).toISOString(),
        lastUsedAt: new Date(session.lastUsedAt).toISOString(),
        current: session.id === currentSessionId,
      }));
  }

  /** Returns false when the session does not belong to the user. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    if (!session || session.userId !== userId) return false;
    await this.redis.multi().del(sessionKey(sessionId)).sRem(userSessionsKey(userId), sessionId).exec();
    return true;
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const ids = (await this.redis.sMembers(userSessionsKey(userId))).filter((id) => id !== exceptSessionId);
    if (!ids.length) return 0;
    await this.redis.multi().del(ids.map(sessionKey)).sRem(userSessionsKey(userId), ids).exec();
    return ids.length;
  }

  private issue(sessionId: string, secret: string): IssuedRefresh {
    return { refreshToken: `${sessionId}.${secret}`, expiresAt: new Date(Date.now() + this.ttlMs) };
  }
}

function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}
