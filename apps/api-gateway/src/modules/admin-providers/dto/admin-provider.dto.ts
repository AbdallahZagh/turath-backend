import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsOneOf, trim } from '@turath/common';
import {
  COMMISSION_TIERS,
  CREDIT_TIERS,
  GOVERNORATES,
  PROVIDER_ACCOUNT_EVENT_KINDS,
  PROVIDER_ACTIVITY_CHANNELS,
  PROVIDER_ACTIVITY_KINDS,
  PROVIDER_CATEGORIES,
  PROVIDER_DOCUMENT_KINDS,
  PROVIDER_STATUSES,
  type AdminProviderAccountEvent,
  type AdminProviderActivityEvent,
  type AdminProviderDetailView,
  type AdminProviderDocument,
  type AdminProviderPage,
  type AdminProviderSummary,
  type AdminProviderView,
  type AdminRating,
  type CommissionTier,
  type CreditTier,
  type Governorate,
  type ProviderActivityChannel,
  type ProviderActivityKind,
  type ProviderCategory,
  type ProviderDocumentKind,
  type ProviderAccountEventKind,
  type ProviderInventory,
  type ProviderStatus,
} from '@turath/contracts';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { AdminReviewDto } from '../../admin-reviews/dto/admin-review.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** Average stars from the reviews about a provider. */
export class AdminRatingDto implements AdminRating {
  @ApiProperty({ example: 4.5, description: 'Mean of the stars, `0` when there are no reviews.' }) average: number;
  @ApiProperty({ example: 12, description: 'Number of reviews about the provider (every moderation status).' })
  count: number;
}

/** One business in `GET /admin/providers`: the columns of the businesses table. */
export class AdminProviderSummaryDto implements AdminProviderSummary {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: LocalizedNameDto, description: 'Business name.' }) name: LocalizedNameDto;
  @ApiProperty({ type: LocalizedNameDto, description: 'Owner name.' }) owner: LocalizedNameDto;
  @ApiProperty({ enum: PROVIDER_CATEGORIES }) category: ProviderCategory;
  @ApiProperty({ enum: GOVERNORATES }) governorate: Governorate;
  @ApiProperty({ enum: PROVIDER_STATUSES }) status: ProviderStatus;
  @ApiProperty({ example: '2026-08-22', description: 'Day the application was submitted, `YYYY-MM-DD`.' })
  submittedAt: string;
  @ApiProperty({ type: AdminRatingDto }) rating: AdminRatingDto;
}

/** `GET /admin/providers`: one page of businesses. */
export class AdminProviderPageDto implements AdminProviderPage {
  @ApiProperty({ type: [AdminProviderSummaryDto], description: 'The businesses on this page, in review order.' })
  items: AdminProviderSummaryDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 17, description: 'Businesses matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 1, description: '`0` when nothing matches.' }) totalPages: number;
}

export class AdminProviderDocumentDto implements AdminProviderDocument {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: PROVIDER_DOCUMENT_KINDS }) kind: ProviderDocumentKind;
  @ApiProperty({ example: 'cr-prv_09.pdf' }) filename: string;
  @ApiProperty({ example: '2026-06-12', description: '`YYYY-MM-DD`' }) uploadedAt: string;
}

export class AdminProviderAccountEventDto implements AdminProviderAccountEvent {
  @ApiProperty({ example: '2026-06-20', description: '`YYYY-MM-DD`' }) at: string;
  @ApiProperty({ enum: PROVIDER_ACCOUNT_EVENT_KINDS }) kind: ProviderAccountEventKind;
}

/** The provider on the detail page. Same shape as `AdminProvider` in the frontend mock, plus `rating`. */
export class AdminProviderDto extends AdminProviderSummaryDto implements AdminProviderView {
  @ApiProperty({ example: '+963 931 133 207', description: 'International format with spaces.' }) phone: string;
  @ApiProperty({ example: 'lina.nasser@example.com' }) email: string;
  @ApiProperty({ type: LocalizedNameDto }) address: LocalizedNameDto;
  @ApiProperty({ type: LocalizedNameDto }) description: LocalizedNameDto;
  @ApiProperty({ type: [AdminProviderDocumentDto], description: 'Commercial registration, licence and owner ID.' })
  documents: AdminProviderDocumentDto[];
  @ApiProperty({ enum: COMMISSION_TIERS, description: 'Commission axis.' }) tier: CommissionTier;
  @ApiProperty({ enum: CREDIT_TIERS, description: 'Credit-ceiling axis, separate from the commission tier.' })
  creditTier: CreditTier;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0.1,
    description: 'A fraction (`0.1` = 10%) replacing the tier commission rate, or null.',
  })
  commissionOverride: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: null,
    description: 'Replaces the credit tier ceiling, in Syrian pounds, or null.',
  })
  creditOverrideSyp: number | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'What the provider sells. `kind` is the category: `hotels` → `rooms[]`, `dining` → `tables[]` and `slots[]`, `trips` → `trip`, `events` → `sessions[]`, `guides` → `guide`. See `ProviderInventory` in the frontend `lib/mock/adminProviderInventory.ts`.',
    example: {
      kind: 'hotels',
      rooms: [
        {
          id: 'rm1',
          name: { en: 'Courtyard queen', ar: 'غرفة ملكية على الصحن' },
          occupancy: 2,
          quantity: 8,
          priceSyp: 450000,
          amenities: ['wifi', 'ac'],
        },
      ],
    },
  })
  inventory: ProviderInventory;
  @ApiProperty({ type: [AdminProviderAccountEventDto], description: 'Oldest first.' })
  accountEvents: AdminProviderAccountEventDto[];
}

/** One line of the activity timeline. */
export class AdminProviderActivityEventDto implements AdminProviderActivityEvent {
  @ApiProperty({ example: 'f1c2…_approved_2026-06-20_1' }) id: string;
  @ApiProperty({ example: '2026-06-20', description: '`YYYY-MM-DD`' }) at: string;
  @ApiProperty({ enum: PROVIDER_ACTIVITY_KINDS }) kind: ProviderActivityKind;
  @ApiProperty({ enum: PROVIDER_ACTIVITY_CHANNELS, isArray: true }) channels: ProviderActivityChannel[];
  @ApiPropertyOptional({ type: LocalizedNameDto, description: 'Booking events only.' }) guest?: LocalizedNameDto;
  @ApiPropertyOptional({ example: 180000, description: 'Money events only.' }) amountSyp?: number;
  @ApiPropertyOptional({ example: 'K7M2QX', description: 'Booking events only.' }) bookingCode?: string;
}

/** `GET /admin/providers/{id}`: everything the business detail page shows. */
export class AdminProviderDetailDto implements AdminProviderDetailView {
  @ApiProperty({ type: AdminProviderDto }) provider: AdminProviderDto;
  @ApiProperty({ type: 'null', nullable: true, example: null, description: 'Always `null` until the ledger exists.' })
  ledger: null;
  @ApiProperty({ type: [AdminProviderActivityEventDto], description: 'Newest first.' })
  activity: AdminProviderActivityEventDto[];
  @ApiProperty({ type: [AdminReviewDto], description: 'Reviews about this business, newest first.' })
  reviews: AdminReviewDto[];
}

/** `GET /admin/providers?page=&limit=&status=&category=&governorate=&search=`. Everything is optional. */
export class ListProvidersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PROVIDER_STATUSES, description: 'Only businesses in this status.' })
  @IsOneOf(PROVIDER_STATUSES, 'validation.PROVIDER_STATUS', { optional: true })
  status?: ProviderStatus;

  @ApiPropertyOptional({ enum: PROVIDER_CATEGORIES, description: 'Only businesses of this kind.' })
  @IsOneOf(PROVIDER_CATEGORIES, 'validation.PROVIDER_CATEGORY', { optional: true })
  category?: ProviderCategory;

  @ApiPropertyOptional({ enum: GOVERNORATES, description: 'Only businesses in this region.' })
  @IsOneOf(GOVERNORATES, 'validation.GOVERNORATE', { optional: true })
  governorate?: Governorate;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'beit',
    description: 'Matches the business name or the owner (English or Arabic), ignoring case. Empty means no search.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  search?: string;
}

/** `GET /admin/providers/export?status=&category=&governorate=&search=`: the same filters, no paging. */
export class ExportProvidersQueryDto extends OmitType(ListProvidersQueryDto, ['page', 'limit'] as const) {}
