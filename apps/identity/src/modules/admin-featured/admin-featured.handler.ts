import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminFeaturedPatterns,
  type AdminPromotion,
  type AdminPromotionCreatePayload,
  type AdminPromotionDeletePayload,
  type AdminPromotionGetPayload,
  type AdminPromotionListPayload,
  type AdminPromotionPage,
  type AdminPromotionUpdatePayload,
  type FeaturedSlotsOverview,
  type FeaturedSlotsSavePayload,
  type LiveFeatured,
  type PromotionTarget,
  type PromotionTargetsPayload,
} from '@turath/contracts';
import { AdminFeaturedService } from './admin-featured.service.js';

/** RabbitMQ handlers for the Featured page. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminFeaturedHandler {
  constructor(private readonly featured: AdminFeaturedService) {}

  @MessagePattern(AdminFeaturedPatterns.LIST)
  list(@Payload() query: AdminPromotionListPayload): Promise<AdminPromotionPage> {
    return this.featured.list(query);
  }

  @MessagePattern(AdminFeaturedPatterns.GET)
  get(@Payload() { id }: AdminPromotionGetPayload): Promise<AdminPromotion> {
    return this.featured.get(id);
  }

  @MessagePattern(AdminFeaturedPatterns.CREATE)
  create(@Payload() payload: AdminPromotionCreatePayload): Promise<AdminPromotion> {
    return this.featured.create(payload);
  }

  @MessagePattern(AdminFeaturedPatterns.UPDATE)
  update(@Payload() payload: AdminPromotionUpdatePayload): Promise<AdminPromotion> {
    return this.featured.update(payload);
  }

  @MessagePattern(AdminFeaturedPatterns.DELETE)
  delete(@Payload() payload: AdminPromotionDeletePayload): Promise<{ id: string }> {
    return this.featured.delete(payload).then(() => ({ id: payload.id }));
  }

  @MessagePattern(AdminFeaturedPatterns.TARGETS)
  targets(@Payload() query: PromotionTargetsPayload): Promise<PromotionTarget[]> {
    return this.featured.targets(query);
  }

  @MessagePattern(AdminFeaturedPatterns.SLOTS)
  slots(): Promise<FeaturedSlotsOverview> {
    return this.featured.slots();
  }

  @MessagePattern(AdminFeaturedPatterns.SLOTS_SAVE)
  saveSlots(@Payload() payload: FeaturedSlotsSavePayload): Promise<FeaturedSlotsOverview> {
    return this.featured.saveSlots(payload);
  }

  @MessagePattern(AdminFeaturedPatterns.LIVE)
  live(): Promise<LiveFeatured> {
    return this.featured.live();
  }
}
