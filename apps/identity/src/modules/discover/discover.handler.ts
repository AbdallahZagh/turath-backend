import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { DiscoverPatterns, type DiscoverOptions, type DiscoverPage, type DiscoverPayload } from '@turath/contracts';
import { DiscoverService } from './discover.service.js';

/** RabbitMQ handlers for the landing page search widget. The gateway validates input and rate limits. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class DiscoverHandler {
  constructor(private readonly discover: DiscoverService) {}

  @MessagePattern(DiscoverPatterns.SEARCH)
  search(@Payload() payload: DiscoverPayload): Promise<DiscoverPage> {
    return this.discover.search(payload);
  }

  @MessagePattern(DiscoverPatterns.OPTIONS)
  options(): Promise<DiscoverOptions> {
    return this.discover.options();
  }
}
