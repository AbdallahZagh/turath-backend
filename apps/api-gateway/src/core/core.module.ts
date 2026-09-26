import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { IDENTITY_CLIENT, IDENTITY_QUEUE } from '@turath/contracts';
import { AuthCookies } from './auth/auth-cookies.js';
import { IdentityClient } from './clients/identity.client.js';

/**
 * Shared by every feature module: the clients for the backend services and
 * the session / preference cookie helper. A new service gets one more
 * ClientsModule entry and a client wrapper here.
 */
@Global()
@Module({
  imports: [
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
  providers: [IdentityClient, AuthCookies],
  exports: [IdentityClient, AuthCookies],
})
export class CoreModule {}
