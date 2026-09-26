import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { IDENTITY_QUEUE } from '@turath/contracts';
import { IdentityModule } from './identity.module.js';

/**
 * Hybrid app: consumes RabbitMQ messages from the gateway, and serves a tiny
 * internal HTTP port only for the container healthcheck.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(IdentityModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [config.getOrThrow<string>('RABBITMQ_URL')],
        queue: IDENTITY_QUEUE,
        queueOptions: { durable: true },
        prefetchCount: 20,
      },
    },
    { inheritAppConfig: true },
  );
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  const port = Number(config.get('IDENTITY_HEALTH_PORT') ?? 4001);
  await app.listen(port);
  Logger.log(`identity listening on queue "${IDENTITY_QUEUE}" (health :${port})`, 'Bootstrap');
}

await bootstrap();
