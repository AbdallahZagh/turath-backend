import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import { HttpCacheInterceptor } from '../../core/interceptors/http-cache.interceptor.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import {
  CreatePromotionDocs,
  DeletePromotionDocs,
  GetPromotionDocs,
  GetSlotsDocs,
  ListPromotionsDocs,
  ListTargetsDocs,
  LiveFeaturedDocs,
  SaveSlotsDocs,
  UpdatePromotionDocs,
} from './featured.docs.js';
import {
  ListPromotionsQueryDto,
  ListPromotionTargetsQueryDto,
  SaveFeaturedSlotsDto,
  SavePromotionDto,
} from './dto/featured.dto.js';

/**
 * Home page promotions for the Featured page of the admin dashboard (`/admin/featured`), behind
 * `x-api-key` (see ApiKeyGuard). `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-featured')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/featured')
export class AdminFeaturedController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListPromotionsDocs()
  list(@Query() { page, limit, kind, slot, status, search }: ListPromotionsQueryDto): Promise<AdminPromotionPage> {
    return this.identity.send<AdminPromotionPage, AdminPromotionListPayload>(AdminFeaturedPatterns.LIST, {
      page,
      limit,
      kind,
      slot,
      status,
      search: search || undefined,
    });
  }

  @Get('targets')
  @ListTargetsDocs()
  targets(@Query() { type, search, limit }: ListPromotionTargetsQueryDto): Promise<PromotionTarget[]> {
    return this.identity.send<PromotionTarget[], PromotionTargetsPayload>(AdminFeaturedPatterns.TARGETS, {
      type,
      search: search || undefined,
      limit,
    });
  }

  @Get('slots')
  @GetSlotsDocs()
  slots(): Promise<FeaturedSlotsOverview> {
    return this.identity.send<FeaturedSlotsOverview, Record<string, never>>(AdminFeaturedPatterns.SLOTS, {});
  }

  @Put('slots')
  @SaveSlotsDocs()
  saveSlots(@Body() { featuringEnabled, slots }: SaveFeaturedSlotsDto): Promise<FeaturedSlotsOverview> {
    return this.identity.send<FeaturedSlotsOverview, FeaturedSlotsSavePayload>(AdminFeaturedPatterns.SLOTS_SAVE, {
      featuringEnabled,
      slots: { ...slots },
    });
  }

  @Get(':id')
  @GetPromotionDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminPromotion> {
    return this.identity.send<AdminPromotion, AdminPromotionGetPayload>(AdminFeaturedPatterns.GET, { id });
  }

  @Post()
  @CreatePromotionDocs()
  create(@Body() input: SavePromotionDto): Promise<AdminPromotion> {
    return this.identity.send<AdminPromotion, AdminPromotionCreatePayload>(AdminFeaturedPatterns.CREATE, {
      input: pick(input),
    });
  }

  @Put(':id')
  @UpdatePromotionDocs()
  update(@Param('id', ParseIdPipe) id: string, @Body() input: SavePromotionDto): Promise<AdminPromotion> {
    return this.identity.send<AdminPromotion, AdminPromotionUpdatePayload>(AdminFeaturedPatterns.UPDATE, {
      id,
      input: pick(input),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @DeletePromotionDocs()
  async delete(@Param('id', ParseIdPipe) id: string): Promise<void> {
    await this.identity.send<{ id: string }, AdminPromotionDeletePayload>(AdminFeaturedPatterns.DELETE, { id });
  }
}

/** Only the fields a promotion is saved with, as plain objects. */
const pick = ({ title, kind, slot, target, startAt, endAt, link }: SavePromotionDto) => ({
  title: { en: title.en, ar: title.ar },
  kind,
  slot,
  target: { en: target.en, ar: target.ar },
  startAt,
  endAt,
  link: link ? { type: link.type, id: link.id } : null,
});

/**
 * What the home page shows: the promotions running today in each active slot. Public, cached for
 * 30 seconds here and for the browser and CDN too.
 */
@ApiTags('featured')
@RateLimited()
@Public()
@Controller('featured')
@UseInterceptors(HttpCacheInterceptor)
export class LiveFeaturedController {
  constructor(private readonly identity: IdentityClient) {}

  @Get('live')
  @CacheTTL(30_000)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  @LiveFeaturedDocs()
  live(): Promise<LiveFeatured> {
    return this.identity.send<LiveFeatured, Record<string, never>>(AdminFeaturedPatterns.LIVE, {});
  }
}
