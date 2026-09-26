import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { identityEnvSchema } from '@turath/common';
import { RedisModule } from '@turath/redis';
import { AuthService } from './auth/auth.service.js';
import { IdentityController } from './auth/identity.controller.js';
import { ConsoleOtpSender, OtpSender } from './otp/otp.sender.js';
import { OtpService } from './otp/otp.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [
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
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    PrismaService,
    UsersService,
    OtpService,
    AuthService,
    { provide: OtpSender, useClass: ConsoleOtpSender },
  ],
})
export class IdentityModule {}
