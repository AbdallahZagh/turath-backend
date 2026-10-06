import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminTaxonomyPatterns,
  type AdminTaxonomyCreatePayload,
  type AdminTaxonomyDeletePayload,
  type AdminTaxonomyListPayload,
  type AdminTaxonomyMovePayload,
  type AdminTaxonomyTerm,
  type AdminTaxonomyUpdatePayload,
} from '@turath/contracts';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';

/** RabbitMQ handlers for the admin lists. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminTaxonomyHandler {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @MessagePattern(AdminTaxonomyPatterns.LIST)
  list(@Payload() query: AdminTaxonomyListPayload): Promise<AdminTaxonomyTerm[]> {
    return this.taxonomy.list(query);
  }

  @MessagePattern(AdminTaxonomyPatterns.CREATE)
  create(@Payload() payload: AdminTaxonomyCreatePayload): Promise<AdminTaxonomyTerm> {
    return this.taxonomy.create(payload);
  }

  @MessagePattern(AdminTaxonomyPatterns.UPDATE)
  update(@Payload() payload: AdminTaxonomyUpdatePayload): Promise<AdminTaxonomyTerm> {
    return this.taxonomy.update(payload);
  }

  @MessagePattern(AdminTaxonomyPatterns.MOVE)
  move(@Payload() payload: AdminTaxonomyMovePayload): Promise<AdminTaxonomyTerm[]> {
    return this.taxonomy.move(payload);
  }

  @MessagePattern(AdminTaxonomyPatterns.DELETE)
  delete(@Payload() payload: AdminTaxonomyDeletePayload): Promise<AdminTaxonomyTerm[]> {
    return this.taxonomy.delete(payload);
  }
}
