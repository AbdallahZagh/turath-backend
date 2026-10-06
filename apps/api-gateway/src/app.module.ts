import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { I18nModule, I18nValidationPipe } from 'nestjs-i18n';
import { AllExceptionsFilter, gatewayEnvSchema, i18nOptions } from '@turath/common';
import { REDIS_CLIENT, RedisModule, RedisThrottlerStorage, type RedisClient } from '@turath/redis';
import { JwtAuthGuard, RolesGuard } from './core/auth/auth.guards.js';
import { CoreModule } from './core/core.module.js';
import { AppThrottlerGuard } from './core/guards/app-throttler.guard.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AdminBookingsModule } from './modules/admin-bookings/admin-bookings.module.js';
import { AdminCouponsModule } from './modules/admin-coupons/admin-coupons.module.js';
import { AdminDisputesModule } from './modules/admin-disputes/admin-disputes.module.js';
import { AdminFeesModule } from './modules/admin-fees/admin-fees.module.js';
import { AdminHeritageSitesModule } from './modules/admin-heritage-sites/admin-heritage-sites.module.js';
import { AdminLedgerModule } from './modules/admin-ledger/admin-ledger.module.js';
import { AdminProvidersModule } from './modules/admin-providers/admin-providers.module.js';
import { AdminReviewsModule } from './modules/admin-reviews/admin-reviews.module.js';
import { AdminTaxonomyModule } from './modules/admin-taxonomy/admin-taxonomy.module.js';
import { FeaturedModule } from './modules/featured/featured.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MetaModule } from './modules/meta/meta.module.js';
import { PreferencesModule } from './modules/preferences/preferences.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';

@Module({
  imports: [
    // ── platform ──
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: gatewayEnvSchema,
    }),
    I18nModule.forRoot(i18nOptions()),
    RedisModule,

    // Response cache (Redis via Keyv). Opt-in per route with HttpCacheInterceptor.
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.getOrThrow<string>('REDIS_URL'), { namespace: 'gateway-cache' })],
        ttl: Number(config.get('CACHE_TTL_SECONDS')) * 1000,
      }),
    }),

    // Global rate limit, stored in Redis. Tighter limits use @Throttle() per route.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: RedisClient) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get('THROTTLE_TTL_SECONDS')) * 1000,
            limit: Number(config.get('THROTTLE_LIMIT')),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),

    CoreModule,

    // ── API areas (Swagger lists them in this order) ──
    AuthModule,
    ProfileModule,
    SessionsModule,
    PreferencesModule,
    MetaModule,
    HealthModule,
    AdminModule,
    AdminUsersModule,
    AdminReviewsModule,
    AdminBookingsModule,
    AdminProvidersModule,
    AdminDisputesModule,
    AdminLedgerModule,
    AdminFeesModule,
    AdminHeritageSitesModule,
    AdminTaxonomyModule,
    FeaturedModule,
    AdminCouponsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new I18nValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    },
    // Order matters: authenticate first so the throttler can key by user id.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
