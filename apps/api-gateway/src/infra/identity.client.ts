import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { sendRpc } from '@turath/common';
import { IDENTITY_CLIENT } from '@turath/contracts';

/** Typed-by-call-site wrapper around the RabbitMQ client for the identity service. */
@Injectable()
export class IdentityClient implements OnApplicationBootstrap {
  private readonly timeoutMs: number;

  constructor(
    @Inject(IDENTITY_CLIENT) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    this.timeoutMs = Number(config.get('RPC_TIMEOUT_MS') ?? 5000);
  }

  async onApplicationBootstrap(): Promise<void> {
    // Connect eagerly so the first request doesn't pay for it; failures are retried on send.
    await this.client.connect().catch(() => undefined);
  }

  send<TResult, TPayload = unknown>(pattern: string, payload: TPayload, timeoutMs = this.timeoutMs): Promise<TResult> {
    return sendRpc<TResult, TPayload>(this.client, pattern, payload, timeoutMs);
  }
}
