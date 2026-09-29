import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsIntInRange, IsOneOf, trim } from '@turath/common';
import {
  REVIEW_ABOUT,
  REVIEW_MODERATION_STATUSES,
  type AdminReview,
  type AdminReviewPage,
  type ReviewAbout,
  type ReviewModerationStatus,
  type ReviewStars,
} from '@turath/contracts';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';

/** The text in each language. */
export class LocalizedTextDto {
  @ApiProperty({ example: 'Rami Haddad' }) en: string;
  @ApiProperty({ example: 'رامي حداد' }) ar: string;
}

/** One review. Same shape as `AdminReview` in the frontend mock (`status` is always present here). */
export class AdminReviewDto implements AdminReview {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: REVIEW_ABOUT, description: 'Whether the review rates a provider or a guest.' })
  about: ReviewAbout;
  @ApiProperty({ example: 'Beit Al-Wali', description: 'English name of the provider or guest being rated.' })
  subjectEn: string;
  @ApiProperty({ type: LocalizedTextDto, description: 'Who wrote it.' }) author: LocalizedTextDto;
  @ApiProperty({ enum: [1, 2, 3, 4, 5] }) stars: ReviewStars;
  @ApiProperty({ type: LocalizedTextDto, description: 'The review text in English and Arabic.' })
  body: LocalizedTextDto;
  @ApiProperty({ example: '2026-08-31', description: 'Day the review was left (UTC), `YYYY-MM-DD`.' }) at: string;
  @ApiProperty({ example: 'K7M2QX', description: 'The booking the review is about.' }) bookingCode: string;
  @ApiProperty({
    enum: REVIEW_MODERATION_STATUSES,
    description: '`published` (visible), `flagged` (needs a look) or `hidden`.',
  })
  status: ReviewModerationStatus;
}

/** `GET /admin/reviews`: one page of reviews. */
export class AdminReviewPageDto implements AdminReviewPage {
  @ApiProperty({ type: [AdminReviewDto], description: 'The reviews on this page, newest first.' })
  items: AdminReviewDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 57, description: 'Reviews matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 3, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/reviews?page=&limit=&about=&stars=&status=&search=`. Everything is optional. */
export class ListReviewsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: REVIEW_ABOUT, description: 'Only reviews about providers, or only about guests.' })
  @IsOneOf(REVIEW_ABOUT, 'validation.REVIEW_ABOUT', { optional: true })
  about?: ReviewAbout;

  @ApiPropertyOptional({ type: Number, enum: [1, 2, 3, 4, 5], description: 'Only reviews with this star rating.' })
  @IsIntInRange({ min: 1, max: 5, optional: true })
  stars?: ReviewStars;

  @ApiPropertyOptional({ enum: REVIEW_MODERATION_STATUSES, description: 'Only reviews in this moderation status.' })
  @IsOneOf(REVIEW_MODERATION_STATUSES, 'validation.REVIEW_STATUS', { optional: true })
  status?: ReviewModerationStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'beit',
    description:
      'Matches the subject, author, review text (English or Arabic) and booking code, ignoring case. Empty means no search.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  search?: string;
}

/** `PATCH /admin/reviews/{id}/status` */
export class SetReviewStatusDto {
  @ApiProperty({ enum: REVIEW_MODERATION_STATUSES, description: 'The moderation status to set.' })
  @IsOneOf(REVIEW_MODERATION_STATUSES, 'validation.REVIEW_STATUS')
  status: ReviewModerationStatus;
}
