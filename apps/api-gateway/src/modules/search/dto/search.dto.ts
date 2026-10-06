import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsIntInRange, IsOneOf, IsText } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  GOVERNORATES,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_DEPTH,
  SEARCH_MAX_LENGTH,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_LENGTH,
  SEARCH_TYPES,
  type BookingCategory,
  type Governorate,
  type SearchPage,
  type SearchResult,
  type SearchType,
} from '@turath/contracts';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One thing found. */
export class SearchResultDto implements SearchResult {
  @ApiProperty({
    enum: SEARCH_TYPES,
    description: '`heritageSite`, `provider` (a business), `category` (a booking category) or `region`.',
  })
  type: SearchType;
  @ApiProperty({ description: 'The id of the heritage site or business, or the slug of the category or region.' })
  id: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'umayyad-mosque',
    description: 'The heritage site slug, or the category / region slug; `null` for a business.',
  })
  slug: string | null;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({
    type: LocalizedNameDto,
    nullable: true,
    description: 'The start of its description in both languages; `null` for a category or region.',
  })
  summary: LocalizedNameDto | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cover image of a heritage site; `null` for everything else.',
  })
  imageSrc: string | null;
  @ApiProperty({
    enum: BOOKING_CATEGORIES,
    nullable: true,
    description: 'The booking category of a business or category.',
  })
  category: BookingCategory | null;
  @ApiProperty({ enum: GOVERNORATES, nullable: true, description: 'Where a heritage site or business is.' })
  governorate: Governorate | null;
  @ApiProperty({ example: '/attractions/umayyad-mosque', description: 'Where the frontend opens it.' }) href: string;
  @ApiProperty({
    example: 112.5,
    description: 'How well it matched, higher first. Only meaningful for comparing the results of one search.',
  })
  score: number;
}

/** `GET /search`. */
export class SearchPageDto implements SearchPage {
  @ApiProperty({ example: 'citadel', description: 'The query as it was searched (trimmed).' }) query: string;
  @ApiProperty({ type: [SearchResultDto], description: 'Best match first.' }) items: SearchResultDto[];
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: SEARCH_DEFAULT_LIMIT }) limit: number;
  @ApiProperty({ description: '`true` when the next page has more results.' }) hasMore: boolean;
}

/** `GET /search?q=&type=&category=&governorate=&page=&limit=`. Only `q` is required. */
export class SearchQueryDto {
  @ApiProperty({
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
    example: 'citadel',
    description:
      'What to look for, in English or Arabic. Every word has to appear (in any order, any part of a word); a one-word query also forgives typos.',
  })
  @IsText({ min: SEARCH_MIN_LENGTH, max: SEARCH_MAX_LENGTH })
  q: string;

  @ApiPropertyOptional({ enum: SEARCH_TYPES, description: 'Only this kind of result.' })
  @IsOneOf(SEARCH_TYPES, 'validation.SEARCH_TYPE', { optional: true })
  type?: SearchType;

  @ApiPropertyOptional({
    enum: BOOKING_CATEGORIES,
    description: 'Only businesses of this booking category, and the category itself.',
  })
  @IsOneOf(BOOKING_CATEGORIES, 'validation.BOOKING_CATEGORY', { optional: true })
  category?: BookingCategory;

  @ApiPropertyOptional({ enum: GOVERNORATES, description: 'Only what is in this governorate.' })
  @IsOneOf(GOVERNORATES, 'validation.GOVERNORATE', { optional: true })
  governorate?: Governorate;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    default: 1,
    description: `Page number, starting at 1. Results deeper than ${SEARCH_MAX_DEPTH} (page x limit) are not available.`,
  })
  @IsIntInRange({ min: 1, max: SEARCH_MAX_DEPTH, optional: true })
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: SEARCH_MAX_LIMIT,
    default: SEARCH_DEFAULT_LIMIT,
    description: `Results per page, up to ${SEARCH_MAX_LIMIT}.`,
  })
  @IsIntInRange({ min: 1, max: SEARCH_MAX_LIMIT, optional: true })
  limit: number = SEARCH_DEFAULT_LIMIT;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}
