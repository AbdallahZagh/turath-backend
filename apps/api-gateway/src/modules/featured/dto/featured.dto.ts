import { applyDecorators } from '@nestjs/common';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsCalendarDate, IsIntInRange, IsNotBefore, IsOneOf, IsText, Required, trim } from '@turath/common';
import {
  FEATURED_SLOT_CAPACITY,
  FEATURED_SLOT_IDS,
  PROMOTION_KINDS,
  PROMOTION_LINK_TYPES,
  PROMOTION_STATUSES,
  PROMOTION_TARGETS_DEFAULT_LIMIT,
  PROMOTION_TARGETS_MAX_LIMIT,
  type AdminPromotion,
  type AdminPromotionPage,
  type FeaturedSlotId,
  type FeaturedSlotOverview,
  type FeaturedSlotsOverview,
  type FeaturedSlotsSavePayload,
  type LiveFeatured,
  type PromotionKind,
  type PromotionLink,
  type PromotionLinkInput,
  type PromotionLinkType,
  type PromotionStatus,
  type PromotionTarget,
  type SavePromotionInput,
} from '@turath/contracts';
import { IsNestedObject } from '../../../core/dto/nested-object.js';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

const TEXT_MAX = 150;

/** What a saved promotion links to, with the name of it and whether it can still be opened. */
export class PromotionLinkDto implements PromotionLink {
  @ApiProperty({ enum: PROMOTION_LINK_TYPES }) type: PromotionLinkType;
  @ApiProperty({ description: 'The id of the heritage site or business, or the category (`hotels`, `dining`…).' })
  id: string;
  @ApiProperty({ type: LocalizedNameDto, description: 'Name of the thing linked, in both languages.' })
  name: LocalizedNameDto;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'umayyad-mosque',
    description:
      "The page it opens: the heritage site's slug, or the category. `null` for a business (no public page yet).",
  })
  slug: string | null;
  @ApiProperty({
    description:
      '`false` when the business is no longer approved or the site no longer published. The link is kept, but the promotion is not shown on the home page.',
  })
  available: boolean;
}

/** One promotion. Same shape as `AdminPromotion` in the frontend mock, plus `status` and `link`. */
export class AdminPromotionDto implements AdminPromotion {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: LocalizedNameDto }) title: LocalizedNameDto;
  @ApiProperty({
    enum: PROMOTION_KINDS,
    description: '`campaign` only in `home_campaign`; `featured` in every other slot.',
  })
  kind: PromotionKind;
  @ApiProperty({ enum: FEATURED_SLOT_IDS, description: 'Where on the home page it appears.' }) slot: FeaturedSlotId;
  @ApiProperty({ type: LocalizedNameDto, description: 'What is promoted: a business, a site, a category…' })
  target: LocalizedNameDto;
  @ApiProperty({ example: '2026-09-01', description: 'First day it runs, `YYYY-MM-DD`.' }) startAt: string;
  @ApiProperty({ example: '2026-09-30', description: 'Last day it runs (included), `YYYY-MM-DD`.' }) endAt: string;
  @ApiProperty({
    enum: PROMOTION_STATUSES,
    description:
      '`scheduled` before `startAt`, `live` from `startAt` to `endAt`, `ended` after. Worked out from today (UTC).',
  })
  status: PromotionStatus;
  @ApiProperty({
    type: PromotionLinkDto,
    nullable: true,
    description: 'What it opens, or `null` for a promotion that is only text.',
  })
  link: PromotionLinkDto | null;
}

/** `GET /admin/featured`: one page of promotions. */
export class AdminPromotionPageDto implements AdminPromotionPage {
  @ApiProperty({ type: [AdminPromotionDto], description: 'The promotions on this page, newest first.' })
  items: AdminPromotionDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 11, description: 'Promotions matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 1, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/featured?page=&limit=&kind=&slot=&status=&search=`. Everything is optional. */
export class ListPromotionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PROMOTION_KINDS, description: 'Only promotions of this kind.' })
  @IsOneOf(PROMOTION_KINDS, 'validation.PROMOTION_KIND', { optional: true })
  kind?: PromotionKind;

  @ApiPropertyOptional({ enum: FEATURED_SLOT_IDS, description: 'Only promotions in this slot.' })
  @IsOneOf(FEATURED_SLOT_IDS, 'validation.FEATURED_SLOT', { optional: true })
  slot?: FeaturedSlotId;

  @ApiPropertyOptional({
    enum: PROMOTION_STATUSES,
    description: 'Only promotions that are scheduled, live or ended today.',
  })
  @IsOneOf(PROMOTION_STATUSES, 'validation.PROMOTION_STATUS', { optional: true })
  status?: PromotionStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'citadel',
    description:
      'Matches the title and target (English or Arabic) and the slot id, ignoring case. Empty means no search.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  search?: string;
}

/** The title or target in each language. */
export class PromotionTextDto {
  @ApiProperty({ example: 'Citadel dusk walks', minLength: 1, maxLength: TEXT_MAX })
  @IsText({ max: TEXT_MAX })
  en: string;

  @ApiProperty({ example: 'مشاوير غروب القلعة', minLength: 1, maxLength: TEXT_MAX })
  @IsText({ max: TEXT_MAX })
  ar: string;
}

/** What a promotion is linked to when it is saved. */
export class PromotionLinkInputDto implements PromotionLinkInput {
  @ApiProperty({ enum: PROMOTION_LINK_TYPES })
  @IsOneOf(PROMOTION_LINK_TYPES, 'validation.PROMOTION_LINK_TYPE')
  type: PromotionLinkType;

  @ApiProperty({
    maxLength: 64,
    example: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
    description:
      'The `id` of a target from `GET /admin/featured/targets`: a heritage site or business id, or the category (`hotels`, `dining`, `trips`, `events`, `guides`).',
  })
  @IsText({ max: 64 })
  id: string;
}

/** `POST /admin/featured` and `PUT /admin/featured/{id}`. Same shape as `SaveAdminPromotionInput` in the frontend mock. */
export class SavePromotionDto implements SavePromotionInput {
  @ApiProperty({ type: PromotionTextDto }) @IsNestedObject(PromotionTextDto) title: PromotionTextDto;

  @ApiProperty({
    enum: PROMOTION_KINDS,
    description: 'Must suit the slot: `campaign` for `home_campaign`, `featured` for every other slot.',
  })
  @IsOneOf(PROMOTION_KINDS, 'validation.PROMOTION_KIND')
  kind: PromotionKind;

  @ApiProperty({ enum: FEATURED_SLOT_IDS })
  @IsOneOf(FEATURED_SLOT_IDS, 'validation.FEATURED_SLOT')
  slot: FeaturedSlotId;

  @ApiProperty({ type: PromotionTextDto, description: 'What is promoted, in each language.' })
  @IsNestedObject(PromotionTextDto)
  target: PromotionTextDto;

  @ApiProperty({ example: '2026-09-01', description: 'First day it runs, `YYYY-MM-DD` (a real day).' })
  @IsCalendarDate()
  startAt: string;

  @ApiProperty({
    example: '2026-09-30',
    description: 'Last day it runs, `YYYY-MM-DD`. The same day as `startAt` or later.',
  })
  @IsNotBefore('startAt')
  @IsCalendarDate()
  endAt: string;

  @ApiPropertyOptional({
    type: PromotionLinkInputDto,
    nullable: true,
    description:
      'What the promotion opens: a category, a published heritage site or an approved business (pick one from `GET /admin/featured/targets`). Left out or `null`: no link. Saving replaces the link, so send it again to keep it.',
  })
  @Type(() => PromotionLinkInputDto)
  @ValidateNested()
  @IsObject({ message: msg('validation.OBJECT') })
  @IsOptional()
  link?: PromotionLinkInputDto | null;
}

/** Something a promotion can be linked to. */
export class PromotionTargetDto implements PromotionTarget {
  @ApiProperty({ enum: PROMOTION_LINK_TYPES }) type: PromotionLinkType;
  @ApiProperty({ description: 'Send this as `link.id`.' }) id: string;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The heritage site slug or the category; `null` for a business.',
  })
  slug: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'damascus',
    description: 'To tell similar names apart: the category of a business, the governorate of a site.',
  })
  detail: string | null;
}

/** `GET /admin/featured/targets?type=&search=&limit=`. Everything is optional. */
export class ListPromotionTargetsQueryDto {
  @ApiPropertyOptional({
    enum: PROMOTION_LINK_TYPES,
    description: 'Only this kind of target. Without it, up to `limit` of each kind.',
  })
  @IsOneOf(PROMOTION_LINK_TYPES, 'validation.PROMOTION_LINK_TYPE', { optional: true })
  type?: PromotionLinkType;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'umayyad',
    description: 'Matches the name (English or Arabic) and slug, ignoring case. Empty means no search.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: PROMOTION_TARGETS_MAX_LIMIT,
    default: PROMOTION_TARGETS_DEFAULT_LIMIT,
    description: 'How many of each kind.',
  })
  @IsIntInRange({ min: 1, max: PROMOTION_TARGETS_MAX_LIMIT, optional: true })
  limit: number = PROMOTION_TARGETS_DEFAULT_LIMIT;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}

/** One slot of the home page. */
export class FeaturedSlotOverviewDto implements FeaturedSlotOverview {
  @ApiProperty({ enum: FEATURED_SLOT_IDS }) slot: FeaturedSlotId;
  @ApiProperty({ example: FEATURED_SLOT_CAPACITY.persona_rail, description: 'How many promotions it holds at once.' })
  capacity: number;
  @ApiProperty({ example: 2, description: 'Promotions in it that are scheduled or live.' }) occupied: number;
  @ApiProperty({ description: "This slot's own switch." }) enabled: boolean;
  @ApiProperty({
    description: '`featuringEnabled` and `enabled`: only an active slot takes promotions and shows on the home page.',
  })
  active: boolean;
  @ApiProperty({ description: '`true` for the slot that takes campaigns (`home_campaign`).' })
  requiresCampaign: boolean;
}

/** `GET /admin/featured/slots` and the result of saving. */
export class FeaturedSlotsOverviewDto implements FeaturedSlotsOverview {
  @ApiProperty({ description: 'Master switch for home page featuring.' }) featuringEnabled: boolean;
  @ApiProperty({ type: [FeaturedSlotOverviewDto], description: 'Every slot, in the order of the slot ids.' })
  slots: FeaturedSlotOverviewDto[];
}

/** A switch: required, true or false. */
const IsSwitch = () => applyDecorators(Required(), IsBoolean({ message: msg('validation.BOOLEAN') }));

/** The switch of every slot. All eight are required. */
export class FeaturedSlotFlagsDto implements Record<FeaturedSlotId, boolean> {
  @ApiProperty() @IsSwitch() heritage_spotlight: boolean;
  @ApiProperty() @IsSwitch() pillar_hotels: boolean;
  @ApiProperty() @IsSwitch() pillar_dining: boolean;
  @ApiProperty() @IsSwitch() pillar_trips: boolean;
  @ApiProperty() @IsSwitch() pillar_events: boolean;
  @ApiProperty() @IsSwitch() pillar_guides: boolean;
  @ApiProperty() @IsSwitch() home_campaign: boolean;
  @ApiProperty() @IsSwitch() persona_rail: boolean;
}

/** `PUT /admin/featured/slots`. Same flags as `featuringEnabled` and `featuredSlots` in the frontend's admin settings. */
export class SaveFeaturedSlotsDto implements FeaturedSlotsSavePayload {
  @ApiProperty({ description: 'Master switch for home page featuring.' }) @IsSwitch() featuringEnabled: boolean;
  @ApiProperty({ type: FeaturedSlotFlagsDto, description: 'The switch of each of the eight slots.' })
  @IsNestedObject(FeaturedSlotFlagsDto)
  slots: FeaturedSlotFlagsDto;
}

/** `GET /featured/live`: the live promotions of each slot. */
export class LiveFeaturedDto implements LiveFeatured {
  @ApiProperty({ type: [AdminPromotionDto] }) heritage_spotlight: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) pillar_hotels: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) pillar_dining: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) pillar_trips: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) pillar_events: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) pillar_guides: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) home_campaign: AdminPromotionDto[];
  @ApiProperty({ type: [AdminPromotionDto] }) persona_rail: AdminPromotionDto[];
}
