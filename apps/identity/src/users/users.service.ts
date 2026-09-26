import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ErrorCode, rpcError, type Locale, type Theme } from '@turath/common';
import type { UserView } from '@turath/contracts';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (id: string) => `user:${id}`;

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    phoneCountry: user.phoneCountry,
    dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    nationality: user.nationality,
    role: user.role,
    reliabilityScore: user.reliabilityScore,
    locale: user.preferredLocale,
    theme: user.preferredTheme,
    phoneVerified: user.phoneVerifiedAt !== null,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Reads go through a Redis cache (cache-manager + Keyv) because the gateway
 * asks for the profile on nearly every page load. Every write evicts the entry.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getView(id: string): Promise<UserView> {
    const cached = await this.cache.get<UserView>(cacheKey(id));
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw rpcError(ErrorCode.USER_NOT_FOUND);

    const view = toUserView(user);
    await this.cache.set(cacheKey(id), view, USER_CACHE_TTL_MS);
    return view;
  }

  async updatePreferences(id: string, prefs: { locale?: Locale; theme?: Theme }): Promise<UserView> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { preferredLocale: prefs.locale, preferredTheme: prefs.theme },
    });
    await this.evict(id);
    return toUserView(user);
  }

  evict(id: string): Promise<boolean> {
    return this.cache.del(cacheKey(id));
  }
}
