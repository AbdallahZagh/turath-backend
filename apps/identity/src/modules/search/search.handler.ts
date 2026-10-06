import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import { SearchPatterns, type SearchPage, type SearchPayload } from '@turath/contracts';
import { SearchService } from './search.service.js';

/** RabbitMQ handler for the public global search. The gateway validates input and rate-limits. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class SearchHandler {
  constructor(private readonly search: SearchService) {}

  @MessagePattern(SearchPatterns.QUERY)
  query(@Payload() payload: SearchPayload): Promise<SearchPage> {
    return this.search.query(payload);
  }
}
