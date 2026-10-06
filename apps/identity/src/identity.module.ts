import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { identityEnvSchema } from '@turath/common';
import { RedisModule } from '@turath/redis';
import { CoreModule } from './core/core.module.js';
import { AdminBookingsModule } from './modules/admin-bookings/admin-bookings.module.js';
import { AdminCouponsModule } from './modules/admin-coupons/admin-coupons.module.js';
import { AdminDisputesModule } from './modules/admin-disputes/admin-disputes.module.js';
import { AdminFeaturedModule } from './modules/admin-featured/admin-featured.module.js';
import { AdminFeesModule } from './modules/admin-fees/admin-fees.module.js';
import { AdminHeritageSitesModule } from './modules/admin-heritage-sites/admin-heritage-sites.module.js';
import { AdminLedgerModule } from './modules/admin-ledger/admin-ledger.module.js';
import { AdminProvidersModule } from './modules/admin-providers/admin-providers.module.js';
import { AdminReviewsModule } from './modules/admin-reviews/admin-reviews.module.js';
import { AdminSettingsModule } from './modules/admin-settings/admin-settings.module.js';
import { AdminTaxonomyModule } from './modules/admin-taxonomy/admin-taxonomy.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // ── platform ──
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: identityEnvSchema,
    }),
    RedisModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.getOrThrow<string>('REDIS_URL'), { namespace: 'identity-cache' })],
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

    // ── areas (each owns its RabbitMQ handlers) ──
    AuthModule,
    UsersModule,
    SessionsModule,
    AdminsModule,
    AdminUsersModule,
    AdminReviewsModule,
    AdminBookingsModule,
    AdminProvidersModule,
    AdminDisputesModule,
    AdminLedgerModule,
    AdminFeesModule,
    AdminHeritageSitesModule,
    AdminTaxonomyModule,
    AdminCouponsModule,
    AdminSettingsModule,
    SearchModule,
    AdminFeaturedModule,
    HealthModule,
  ],
})
export class IdentityModule {}
