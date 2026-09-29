import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminReviewPatterns,
  type AdminReview,
  type AdminReviewListPayload,
  type AdminReviewPage,
  type AdminReviewStatusPayload,
} from '@turath/contracts';
import { AdminReviewsService } from './admin-reviews.service.js';

/** RabbitMQ handlers for review moderation. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminReviewsHandler {
  constructor(private readonly reviews: AdminReviewsService) {}

  @MessagePattern(AdminReviewPatterns.LIST)
  list(@Payload() query: AdminReviewListPayload): Promise<AdminReviewPage> {
    return this.reviews.list(query);
  }

  @MessagePattern(AdminReviewPatterns.SET_STATUS)
  setStatus(@Payload() payload: AdminReviewStatusPayload): Promise<AdminReview> {
    return this.reviews.setStatus(payload);
  }
}
