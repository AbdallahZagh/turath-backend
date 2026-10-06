import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsOneOf, trim } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  DISPUTE_NOTES_MAX_LENGTH,
  DISPUTE_RESOLUTIONS,
  DISPUTE_STATUSES,
  type AdminDispute,
  type AdminDisputeDetail,
  type AdminDisputePage,
  type BookingCategory,
  type DisputeResolution,
  type DisputeStatus,
} from '@turath/contracts';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One dispute in the table. Same shape as `AdminDispute` in the frontend mock. */
export class AdminDisputeDto implements AdminDispute {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Q8D3ZA', description: 'The 6-character code of the booking in dispute.' })
  bookingCode: string;
  @ApiProperty({ type: LocalizedNameDto }) guest: LocalizedNameDto;
  @ApiProperty({ type: LocalizedNameDto }) provider: LocalizedNameDto;
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({ example: '2026-08-21', description: 'Day the dispute was opened, `YYYY-MM-DD`.' }) openedAt: string;
  @ApiProperty({ example: 640000, description: 'The amount in dispute, in whole Syrian pounds.' }) amountSyp: number;
  @ApiProperty({ type: LocalizedNameDto, description: "The provider's side of the story." })
  providerClaim: LocalizedNameDto;
  @ApiProperty({ type: LocalizedNameDto, description: "The guest's side of the story." })
  touristClaim: LocalizedNameDto;
  @ApiProperty({
    type: LocalizedNameDto,
    description: 'The admin\'s resolution notes. Both languages are `""` until the dispute is resolved.',
  })
  notes: LocalizedNameDto;
  @ApiProperty({
    enum: DISPUTE_STATUSES,
    description: '`open`, `resolvedGuest` (decided for the guest) or `resolvedProvider` (decided for the provider).',
  })
  status: DisputeStatus;
}

/** `GET /admin/disputes/{id}` and the result of resolving: the table row plus when it was filed and settled. */
export class AdminDisputeDetailDto extends AdminDisputeDto implements AdminDisputeDetail {
  @ApiProperty({ example: '2026-08-21T09:12:44.000Z', description: 'When the dispute was filed.' })
  createdAt: string;
  @ApiProperty({ example: '2026-08-28T14:03:10.000Z', description: 'When the dispute last changed.' })
  updatedAt: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-08-28T14:03:10.000Z',
    description: 'When an admin resolved it, or null while it is open.',
  })
  resolvedAt: string | null;
}

/** `GET /admin/disputes`: one page of disputes. */
export class AdminDisputePageDto implements AdminDisputePage {
  @ApiProperty({ type: [AdminDisputeDto], description: 'The disputes on this page, most recently opened first.' })
  items: AdminDisputeDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 8, description: 'Disputes matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 1, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/disputes?page=&limit=&category=&status=&search=`. Everything is optional. */
export class ListDisputesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_CATEGORIES, description: 'Only disputes about bookings of this kind.' })
  @IsOneOf(BOOKING_CATEGORIES, 'validation.BOOKING_CATEGORY', { optional: true })
  category?: BookingCategory;

  @ApiPropertyOptional({ enum: DISPUTE_STATUSES, description: 'Only disputes in this status.' })
  @IsOneOf(DISPUTE_STATUSES, 'validation.DISPUTE_STATUS', { optional: true })
  status?: DisputeStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'palmyra',
    description:
      'Matches the guest or provider name (English or Arabic) and the booking code, ignoring case. Empty means no search.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  search?: string;
}

/** The resolution note in each language. Either can be empty, but both must be sent. */
export class DisputeNotesDto {
  @ApiProperty({ maxLength: DISPUTE_NOTES_MAX_LENGTH, example: 'Table photo confirmed the double booking.' })
  @MaxLength(DISPUTE_NOTES_MAX_LENGTH, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  @Transform(trim)
  en: string;

  @ApiProperty({ maxLength: DISPUTE_NOTES_MAX_LENGTH, example: 'صورة الطاولة تؤكد الحجز المزدوج.' })
  @MaxLength(DISPUTE_NOTES_MAX_LENGTH, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  @Transform(trim)
  ar: string;
}

/** `PATCH /admin/disputes/{id}/resolve` */
export class ResolveDisputeDto {
  @ApiProperty({ enum: DISPUTE_RESOLUTIONS, description: 'Who the admin decides for.' })
  @IsOneOf(DISPUTE_RESOLUTIONS, 'validation.DISPUTE_RESOLUTION')
  status: DisputeResolution;

  @ApiProperty({ type: DisputeNotesDto, description: 'Why, in English and Arabic (either may be empty).' })
  @Type(() => DisputeNotesDto)
  @ValidateNested()
  @IsObject({ message: msg('validation.OBJECT') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  notes: DisputeNotesDto;
}
