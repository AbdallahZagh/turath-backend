import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { ErrorCode, maskDestination, rpcError } from '@turath/common';
import type {
  AccessTokenClaims,
  AuthChannel,
  AuthResult,
  ClientInfo,
  LoginEmailPayload,
  OtpDispatch,
  OtpSendPayload,
  OtpVerifyPayload,
  PasswordForgotPayload,
  PasswordResetPayload,
  RefreshPayload,
  RegisterPayload,
} from '@turath/contracts';
import { REDIS_CLIENT, SessionStore, type RedisClient } from '@turath/redis';
import { Prisma, type User } from '../generated/prisma/client.js';
import { OtpSender } from '../otp/otp.sender.js';
import { OtpService } from '../otp/otp.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserView, UsersService } from '../users/users.service.js';

const resetKey = (token: string) => `pwd-reset:${createHash('sha256').update(token).digest('hex')}`;

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly resetTtlSeconds: number;
  private readonly devEcho: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly sender: OtpSender,
    private readonly sessions: SessionStore,
    private readonly jwt: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = Number(config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    this.resetTtlSeconds = Number(config.get('RESET_TOKEN_TTL_SECONDS') ?? 600);
    this.devEcho = String(config.get('OTP_DEV_ECHO')) === 'true';
  }

  /**
   * Tourist signup. Unverified leftovers from an abandoned signup with the same
   * phone / email are replaced; verified accounts are a conflict.
   */
  async register(input: RegisterPayload): Promise<OtpDispatch> {
    const existing = await this.prisma.user.findMany({
      where: { OR: [{ phone: input.phone }, { email: input.email }] },
    });
    const verified = existing.find((user) => user.phoneVerifiedAt || user.emailVerifiedAt);
    if (verified) {
      throw rpcError(verified.phone === input.phone ? ErrorCode.PHONE_TAKEN : ErrorCode.EMAIL_TAKEN);
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      await this.prisma.$transaction([
        this.prisma.user.deleteMany({ where: { id: { in: existing.map((user) => user.id) } } }),
        this.prisma.user.create({
          data: {
            fullName: input.fullName,
            dateOfBirth: new Date(input.dateOfBirth),
            nationality: input.nationality,
            phone: input.phone,
            phoneCountry: input.phoneCountry,
            email: input.email,
            passwordHash,
            preferredLocale: input.locale,
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw rpcError(ErrorCode.CONFLICT);
      }
      throw error;
    }

    return this.dispatchOtp('phone', input.phone, input.locale);
  }

  /** Step 1 of email login: check the password, then send a code to the inbox. */
  async loginWithEmail(input: LoginEmailPayload): Promise<OtpDispatch> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user?.passwordHash ? await argon2.verify(user.passwordHash, input.password) : false;
    if (!user || !valid) throw rpcError(ErrorCode.INVALID_CREDENTIALS);
    this.assertActive(user);
    return this.dispatchOtp('email', input.email, user.preferredLocale);
  }

  /**
   * Phone login / resend. Answers the same way whether or not the account
   * exists, so the endpoint cannot be used to discover registered numbers.
   */
  async sendOtp(input: OtpSendPayload): Promise<OtpDispatch> {
    const user = await this.findByDestination(input.channel, input.destination);
    if (!user || user.lockedAt) {
      return this.dispatch(input.channel, input.destination);
    }
    return this.dispatchOtp(input.channel, input.destination, user.preferredLocale);
  }

  async verifyOtp(input: OtpVerifyPayload): Promise<AuthResult> {
    await this.otp.verify(input.channel, input.destination, input.code);

    const user = await this.findByDestination(input.channel, input.destination);
    if (!user) throw rpcError(ErrorCode.OTP_INVALID);
    this.assertActive(user);

    const now = new Date();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        ...(input.channel === 'phone' && !user.phoneVerifiedAt && { phoneVerifiedAt: now }),
        ...(input.channel === 'email' && !user.emailVerifiedAt && { emailVerifiedAt: now }),
      },
    });
    await this.users.evict(user.id);
    return this.startSession(updated, input.client);
  }

  async refresh(input: RefreshPayload): Promise<AuthResult> {
    const result = await this.sessions.rotate(input.refreshToken);
    if (result.status === 'reused') throw rpcError(ErrorCode.REFRESH_TOKEN_REUSED);
    // Another tab refreshed a moment ago; its cookie already holds the new token, so just retry.
    if (result.status === 'race') throw rpcError(ErrorCode.REFRESH_RACE);
    if (result.status !== 'rotated') throw rpcError(ErrorCode.REFRESH_TOKEN_INVALID);

    const user = await this.prisma.user.findUnique({ where: { id: result.session.userId } });
    if (!user || user.lockedAt) {
      await this.sessions.revokeAll(result.session.userId);
      throw rpcError(user ? ErrorCode.ACCOUNT_LOCKED : ErrorCode.SESSION_EXPIRED);
    }

    return {
      accessToken: await this.signAccess({ sub: user.id, role: user.role, sid: result.session.id }),
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshToken: result.refresh.refreshToken,
      refreshTokenExpiresAt: result.refresh.expiresAt.toISOString(),
      sessionId: result.session.id,
      user: toUserView(user),
    };
  }

  /** Always answers the same way; the reset link only goes out when the account exists. */
  async forgotPassword(input: PasswordForgotPayload): Promise<OtpDispatch> {
    const user = await this.findByDestination(input.channel, input.destination);
    const response = this.dispatch(input.channel, input.destination);
    if (!user || user.lockedAt) return response;

    const cooldownKey = `pwd-reset-cooldown:${user.id}`;
    const fresh = await this.redis.set(cooldownKey, '1', { NX: true, EX: this.otp.cooldownSeconds });
    if (fresh === null) {
      throw rpcError(ErrorCode.OTP_COOLDOWN, { seconds: Math.max(await this.redis.ttl(cooldownKey), 1) });
    }

    const token = randomBytes(32).toString('base64url');
    await this.redis.set(resetKey(token), user.id, { EX: this.resetTtlSeconds });
    await this.sender.send({
      kind: 'password-reset',
      channel: input.channel,
      destination: input.destination,
      token,
      locale: user.preferredLocale,
    });
    return { ...response, expiresInSeconds: this.resetTtlSeconds, ...(this.devEcho && { devCode: token }) };
  }

  /** Single-use token; every session is signed out after a reset. */
  async resetPassword(input: PasswordResetPayload): Promise<void> {
    const userId = await this.redis.getDel(resetKey(input.token));
    if (!userId) throw rpcError(ErrorCode.RESET_TOKEN_INVALID);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }) },
    });
    await this.sessions.revokeAll(userId);
    await this.users.evict(userId);
  }

  private async startSession(user: User, client: ClientInfo): Promise<AuthResult> {
    const { sessionId, refresh } = await this.sessions.create(user.id, user.role, client);
    return {
      accessToken: await this.signAccess({ sub: user.id, role: user.role, sid: sessionId }),
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      sessionId,
      user: toUserView(user),
    };
  }

  private signAccess(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, { expiresIn: this.accessTtlSeconds });
  }

  private async dispatchOtp(channel: AuthChannel, destination: string, locale: User['preferredLocale']): Promise<OtpDispatch> {
    const code = await this.otp.issue(channel, destination);
    await this.sender.send({ kind: 'otp', channel, destination, code, locale });
    return { ...this.dispatch(channel, destination), ...(this.devEcho && { devCode: code }) };
  }

  private dispatch(channel: AuthChannel, destination: string): OtpDispatch {
    return {
      channel,
      destination: maskDestination(channel, destination),
      expiresInSeconds: this.otp.ttlSeconds,
      resendInSeconds: this.otp.cooldownSeconds,
    };
  }

  private findByDestination(channel: AuthChannel, destination: string): Promise<User | null> {
    return channel === 'phone'
      ? this.prisma.user.findUnique({ where: { phone: destination } })
      : this.prisma.user.findUnique({ where: { email: destination } });
  }

  private assertActive(user: User): void {
    if (user.lockedAt) throw rpcError(ErrorCode.ACCOUNT_LOCKED);
  }
}
