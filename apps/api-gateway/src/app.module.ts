import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { I18nModule, I18nValidationPipe } from 'nestjs-i18n';
import { AllExceptionsFilter, gatewayEnvSchema, i18nOptions } from '@turath/common';
import { IDENTITY_CLIENT, IDENTITY_QUEUE } from '@turath/contracts';
import { REDIS_CLIENT, RedisModule, RedisThrottlerStorage, type RedisClient } from '@turath/redis';
import { AdminController } from './admin/admin.controller.js';
import { ApiKeyGuard } from './admin/api-key.guard.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthCookies } from './auth/auth.cookies.js';
import { JwtAuthGuard, RolesGuard } from './auth/auth.guards.js';
import { HealthController } from './health/health.controller.js';
import { AppThrottlerGuard } from './infra/app-throttler.guard.js';
import { IdentityClient } from './infra/identity.client.js';
import { MetaController } from './meta/meta.controller.js';
import { PreferencesController } from './preferences/preferences.controller.js';

@Module({
  imports: [
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

    ClientsModule.registerAsync([
      {
        name: IDENTITY_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.getOrThrow<string>('RABBITMQ_URL')],
            queue: IDENTITY_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, PreferencesController, MetaController, HealthController, AdminController],
  providers: [
    AuthCookies,
    IdentityClient,
    ApiKeyGuard,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new I18nValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
    // Order matters: authenticate first so the throttler can key by user id.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
