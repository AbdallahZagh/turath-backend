import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { HeritageVisitPatterns, type HeritageVisitPayload } from '@turath/contracts';
import { HeritageVisitsService } from './heritage-visits.service.js';

/** RabbitMQ handler that counts a visit. The gateway validates the slug and rate limits. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class HeritageVisitsHandler {
  constructor(private readonly visits: HeritageVisitsService) {}

  @MessagePattern(HeritageVisitPatterns.RECORD)
  async record(@Payload() { slug }: HeritageVisitPayload): Promise<{ recorded: true }> {
    await this.visits.record(slug);
    return { recorded: true };
  }
}
