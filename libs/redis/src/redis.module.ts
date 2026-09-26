import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@redis/client';
import { REDIS_CLIENT, type RedisClient } from './redis.constants.js';
import { SessionStore } from './session.store.js';

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }
}

/** One shared Redis connection per process, used for sessions, OTPs and rate limits. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      // Connect inside the factory so nothing can inject a client that is not ready yet.
      useFactory: async (config: ConfigService): Promise<RedisClient> => {
        const logger = new Logger('Redis');
        const client = createClient({ url: config.getOrThrow<string>('REDIS_URL') }) as RedisClient;
        client.on('error', (error: Error) => logger.error(error.message));
        await client.connect();
        logger.log('connected');
        return client;
      },
    },
    RedisShutdown,
    SessionStore,
  ],
  exports: [REDIS_CLIENT, SessionStore],
})
export class RedisModule {}
