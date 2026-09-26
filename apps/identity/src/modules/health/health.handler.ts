import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IdentityPatterns } from '@turath/contracts';

/** Liveness: plain HTTP for the Docker healthcheck, and a RabbitMQ ping for the gateway's /health. */
@Controller()
export class HealthHandler {
  /** Internal port only; not exposed outside the Docker network. */
  @Get('health')
  httpHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @MessagePattern(IdentityPatterns.HEALTH)
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
