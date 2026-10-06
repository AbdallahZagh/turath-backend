import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsCalendarDate, IsIntInRange, IsNotBefore, IsOneOf } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  DISCOVER_DEFAULT_LIMIT,
  DISCOVER_LANGUAGES,
  DISCOVER_MAX_LIMIT,
  DISCOVER_STEPPER,
  DISCOVER_TIME_SLOTS,
  GOVERNORATES,
  type BookingCategory,
  type DiscoverItem,
  type DiscoverLanguage,
  type DiscoverOptions,
  type DiscoverPage,
  type DiscoverTimeSlot,
  type Governorate,
} from '@turath/contracts';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** A field left empty (`?date=`) counts as not given, like an unchosen field of the widget. */
const blankToUndefined = Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value));

const DATE_NOTE = '`YYYY-MM-DD`.';

/**
 * `GET /discover?tab=&...`: the whole widget in one query. `tab` picks the kind of booking; the rest are the
 * widget's fields, and the ones that don't belong to the chosen tab are ignored (switching tabs in the
 * widget keeps what was typed). Only `tab` is required.
 */
export class DiscoverSearchQueryDto {
  @ApiProperty({ enum: BOOKING_CATEGORIES, description: 'The tab: hotels, dining (tables), trips, events or guides.' })
  @IsOneOf(BOOKING_CATEGORIES, 'validation.BOOKING_CATEGORY')
  tab: BookingCategory;

  @ApiPropertyOptional({ enum: GOVERNORATES, description: 'All tabs: only businesses in this region.' })
  @blankToUndefined
  @IsOneOf(GOVERNORATES, 'validation.GOVERNORATE', { optional: true })
  governorate?: Governorate;

  @ApiPropertyOptional({
    example: '2026-12-10',
    description: `Hotels check-in, ${DATE_NOTE} Without it no dates are checked and \`checkOut\` is ignored.`,
  })
  @blankToUndefined
  @IsCalendarDate({ optional: true })
  checkIn?: string;

  @ApiPropertyOptional({
    example: '2026-12-13',
    description: `Hotels check-out, ${DATE_NOTE} Not before \`checkIn\`; the same day counts as one night.`,
  })
  @blankToUndefined
  @IsNotBefore('checkIn')
  @IsCalendarDate({ optional: true })
  checkOut?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: DISCOVER_STEPPER.hotels.min,
    maximum: DISCOVER_STEPPER.hotels.max,
    default: DISCOVER_STEPPER.hotels.default,
    description: 'Hotels: people that have to fit in one room.',
  })
  @IsIntInRange({ min: DISCOVER_STEPPER.hotels.min, max: DISCOVER_STEPPER.hotels.max, optional: true })
  guests?: number;

  @ApiPropertyOptional({
    example: '2026-12-10',
    description: `Tables, trips, events and guides: the day, ${DATE_NOTE} Without it no date is checked.`,
  })
  @blankToUndefined
  @IsCalendarDate({ optional: true })
  date?: string;

  @ApiPropertyOptional({
    enum: DISCOVER_TIME_SLOTS,
    default: DISCOVER_TIME_SLOTS[0],
    description: 'Tables: the time slot.',
  })
  @blankToUndefined
  @IsOneOf(DISCOVER_TIME_SLOTS, 'validation.DISCOVER_TIME', { optional: true })
  time?: DiscoverTimeSlot;

  @ApiPropertyOptional({
    type: Number,
    minimum: DISCOVER_STEPPER.dining.min,
    maximum: DISCOVER_STEPPER.dining.max,
    default: DISCOVER_STEPPER.dining.default,
    description: 'Tables: people the table has to seat.',
  })
  @IsIntInRange({ min: DISCOVER_STEPPER.dining.min, max: DISCOVER_STEPPER.dining.max, optional: true })
  partySize?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: DISCOVER_STEPPER.trips.min,
    maximum: DISCOVER_STEPPER.trips.max,
    default: DISCOVER_STEPPER.trips.default,
    description: 'Trips: seats wanted.',
  })
  @IsIntInRange({ min: DISCOVER_STEPPER.trips.min, max: DISCOVER_STEPPER.trips.max, optional: true })
  seats?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: DISCOVER_STEPPER.events.min,
    maximum: DISCOVER_STEPPER.events.max,
    default: DISCOVER_STEPPER.events.default,
    description: 'Events: tickets wanted.',
  })
  @IsIntInRange({ min: DISCOVER_STEPPER.events.min, max: DISCOVER_STEPPER.events.max, optional: true })
  qty?: number;

  @ApiPropertyOptional({
    enum: DISCOVER_LANGUAGES,
    description:
      'Guides: a language the guide speaks. Only Arabic, English and French exist in guide profiles yet: Kurdish and Turkish find nobody.',
  })
  @blankToUndefined
  @IsOneOf(DISCOVER_LANGUAGES, 'validation.DISCOVER_LANGUAGE', { optional: true })
  language?: DiscoverLanguage;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1, description: 'Page number, starting at 1.' })
  @IsIntInRange({ min: 1, max: 1_000, optional: true })
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: DISCOVER_MAX_LIMIT,
    default: DISCOVER_DEFAULT_LIMIT,
    description: `Results per page, up to ${DISCOVER_MAX_LIMIT}.`,
  })
  @IsIntInRange({ min: 1, max: DISCOVER_MAX_LIMIT, optional: true })
  limit: number = DISCOVER_DEFAULT_LIMIT;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}

class RatingDto {
  @ApiProperty({ example: 4.6 }) average: number;
  @ApiProperty({ example: 12 }) count: number;
}

/** One card. */
export class DiscoverItemDto implements DiscoverItem {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({ enum: GOVERNORATES }) governorate: Governorate;
  @ApiProperty({ type: LocalizedNameDto, description: 'The first 160 characters of the description.' })
  description: LocalizedNameDto;
  @ApiProperty({ type: RatingDto, description: 'Average of the published reviews.' }) rating: RatingDto;
  @ApiProperty({ example: '/hotels/8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b', description: 'Where the frontend opens it.' })
  href: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Why it matched; `kind` says which of: hotels (`roomsFitting`, `fromPriceSyp`, `nights`, `totalFromSyp`), dining (`time`, `tablesFitting`, `zones`), trips (`title`, `date`, `seatsLeft`, `priceSyp`, `pickup`), events (`sessions` up to 3, `fromPriceSyp`), guides (`languages`, `hourlySyp`, `fullDaySyp`).',
    example: { kind: 'hotels', roomsFitting: 2, fromPriceSyp: 150000, nights: 3, totalFromSyp: 450000 },
  })
  match: DiscoverItem['match'];
}

/** One page of cards. */
export class DiscoverPageDto implements DiscoverPage {
  @ApiProperty({ type: [DiscoverItemDto] }) items: DiscoverItemDto[];
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: DISCOVER_DEFAULT_LIMIT }) limit: number;
  @ApiProperty({ example: 24, description: 'Matching businesses across all pages.' }) total: number;
  @ApiProperty({ example: 2, description: '0 when nothing matches.' }) totalPages: number;
}

/** `GET /discover/options`. */
export class DiscoverOptionsDto implements DiscoverOptions {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'The five tabs in order: `id`, `href` and `fields` (each with `id`, `type`, and its limits or options).',
  })
  tabs: DiscoverOptions['tabs'];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: "The regions to choose from, in the admin's order: `{ slug, name: { en, ar } }`.",
  })
  governorates: DiscoverOptions['governorates'];
}
