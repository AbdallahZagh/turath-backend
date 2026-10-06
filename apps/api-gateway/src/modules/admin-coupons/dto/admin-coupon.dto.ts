import { applyDecorators } from '@nestjs/common';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsCalendarDate, IsIntInRange, IsNotBefore, IsOneOf, IsText, Required, trim } from '@turath/common';
import {
  COUPON_CODE_PATTERN,
  COUPON_DISCOUNT_KINDS,
  COUPON_MAX_COUNT,
  COUPON_MAX_FIXED_DISCOUNT_SYP,
  COUPON_SCOPES,
  COUPON_STATUSES,
  COUPON_TARGET_SCOPES,
  COUPON_TARGETS_DEFAULT_LIMIT,
  COUPON_TARGETS_MAX_LIMIT,
  COUPON_TITLE_MAX_LENGTH,
  normalizeCouponCode,
  type AdminCoupon,
  type AdminCouponPage,
  type CouponDiscountKind,
  type CouponScope,
  type CouponStatus,
  type CouponTarget,
  type CouponTargetScope,
  type SaveCouponInput,
} from '@turath/contracts';
import { IsNestedObject } from '../../../core/dto/nested-object.js';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One discount code. Same shape as `AdminCoupon` in the frontend mock, plus `status`, `scopeName`, `redemptions` and the timestamps. */
export class AdminCouponDto implements AdminCoupon {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: LocalizedNameDto }) title: LocalizedNameDto;
  @ApiProperty({ example: 'RAMADAN15', description: 'Upper-case letters and digits, 3 to 16. Unique.' }) code: string;
  @ApiProperty({ enum: COUPON_DISCOUNT_KINDS }) discountKind: CouponDiscountKind;
  @ApiProperty({
    example: 15,
    description: 'A whole percent (1-100) for `percent`; whole Syrian pounds for `fixed`.',
  })
  discountValue: number;
  @ApiProperty({
    enum: COUPON_SCOPES,
    description:
      '`platform` (everything), `pillar` (one booking category), `provider` (one business) or `listing` (one listing).',
  })
  scope: CouponScope;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'dining',
    description:
      'What the scope points at: a category (`hotels`, `dining`, `trips`, `events`, `guides`) for `pillar`, a business id for `provider`, a listing id for `listing`; `null` for `platform`.',
  })
  scopeId: string | null;
  @ApiProperty({ example: '2026-08-20', description: 'First day it can be used, `YYYY-MM-DD`.' }) startAt: string;
  @ApiProperty({ example: '2026-09-20', description: 'Last day it can be used (included), `YYYY-MM-DD`.' })
  endAt: string;
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 400,
    description: 'Most times it can be used in total; `null` for no limit.',
  })
  maxRedemptions: number | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1,
    description: 'Most times one guest can use it; `null` for no limit.',
  })
  perGuestCap: number | null;
  @ApiProperty() enabled: boolean;
  @ApiProperty({
    enum: COUPON_STATUSES,
    description:
      '`disabled` when switched off; otherwise `scheduled` before `startAt`, `live` from `startAt` to `endAt`, `ended` after. Worked out from today (UTC).',
  })
  status: CouponStatus;
  @ApiProperty({
    type: LocalizedNameDto,
    nullable: true,
    description:
      'Name of the category or business the scope points at; `null` for `platform` and for a listing (not known here).',
  })
  scopeName: LocalizedNameDto | null;
  @ApiProperty({ example: 37, description: 'How many bookings used the code so far (cancelled ones are not counted).' })
  redemptions: number;
  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' }) createdAt: string;
  @ApiProperty({ example: '2026-08-02T09:00:00.000Z' }) updatedAt: string;
}

/** `GET /admin/discount-codes`: one page of codes. */
export class AdminCouponPageDto implements AdminCouponPage {
  @ApiProperty({ type: [AdminCouponDto], description: 'The codes on this page, newest first.' })
  items: AdminCouponDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 8, description: 'Codes matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 1, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/discount-codes?page=&limit=&scope=&status=&discountKind=&search=`. Everything is optional. */
export class ListCouponsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: COUPON_SCOPES, description: 'Only codes with this scope.' })
  @IsOneOf(COUPON_SCOPES, 'validation.COUPON_SCOPE', { optional: true })
  scope?: CouponScope;

  @ApiPropertyOptional({
    enum: COUPON_STATUSES,
    description: 'Only codes that are scheduled, live, ended or disabled today.',
  })
  @IsOneOf(COUPON_STATUSES, 'validation.COUPON_STATUS', { optional: true })
  status?: CouponStatus;

  @ApiPropertyOptional({ enum: COUPON_DISCOUNT_KINDS, description: 'Only percent codes, or only fixed-amount codes.' })
  @IsOneOf(COUPON_DISCOUNT_KINDS, 'validation.COUPON_KIND', { optional: true })
  discountKind?: CouponDiscountKind;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'ramadan',
    description:
      'Matches the title (English or Arabic), the code, the listing id, and the name of the category or business the code is for, ignoring case. Empty means no search.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  search?: string;
}

/** The title in each language. */
export class CouponTitleDto {
  @ApiProperty({ example: 'Ramadan dining tables', minLength: 1, maxLength: COUPON_TITLE_MAX_LENGTH })
  @IsText({ max: COUPON_TITLE_MAX_LENGTH })
  en: string;

  @ApiProperty({ example: 'موائد رمضان', minLength: 1, maxLength: COUPON_TITLE_MAX_LENGTH })
  @IsText({ max: COUPON_TITLE_MAX_LENGTH })
  ar: string;
}

/** The code: spaces dropped and upper-cased first, then 3 to 16 letters or digits. */
function IsCouponCode() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeCouponCode(value) : value)),
    Required(),
    IsString({ message: msg('validation.STRING') }),
    Matches(COUPON_CODE_PATTERN, { message: msg('validation.COUPON_CODE') }),
  );
}

/**
 * A whole number from 1: up to 100 when `discountKind` is `percent`, up to the largest fixed
 * discount otherwise.
 */
function IsDiscountValue() {
  return applyDecorators(Required(), (target: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isDiscountValue',
      target: target.constructor,
      propertyName: String(propertyName),
      options: { message: msg('validation.DISCOUNT_VALUE') },
      validator: {
        validate(value: unknown, args): boolean {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return false;
          const kind = (args?.object as { discountKind?: unknown } | undefined)?.discountKind;
          return value <= (kind === 'percent' ? 100 : COUPON_MAX_FIXED_DISCOUNT_SYP);
        },
      },
    }),
  );
}

/** A limit: left out or `null` for none, otherwise a whole number from 1. */
const IsLimit = () =>
  applyDecorators(
    IsOptional(),
    IsInt({ message: msg('validation.COUNT') }),
    Min(1, { message: msg('validation.COUNT') }),
    Max(COUPON_MAX_COUNT, { message: msg('validation.COUNT') }),
  );

/** `POST /admin/discount-codes` and `PUT /admin/discount-codes/{id}`. Same shape as `SaveAdminCouponInput` in the frontend mock. */
export class SaveCouponDto implements SaveCouponInput {
  @ApiProperty({ type: CouponTitleDto }) @IsNestedObject(CouponTitleDto) title: CouponTitleDto;

  @ApiProperty({
    example: 'RAMADAN15',
    pattern: '^[A-Z0-9]{3,16}$',
    description: 'Spaces are dropped and letters upper-cased, then it must be 3 to 16 letters or digits. Unique.',
  })
  @IsCouponCode()
  code: string;

  @ApiProperty({ enum: COUPON_DISCOUNT_KINDS })
  @IsOneOf(COUPON_DISCOUNT_KINDS, 'validation.COUPON_KIND')
  discountKind: CouponDiscountKind;

  @ApiProperty({
    example: 15,
    minimum: 1,
    description: 'A whole percent from 1 to 100 for `percent`; whole Syrian pounds for `fixed` (up to 100,000,000).',
  })
  @IsDiscountValue()
  discountValue: number;

  @ApiProperty({ enum: COUPON_SCOPES }) @IsOneOf(COUPON_SCOPES, 'validation.COUPON_SCOPE') scope: CouponScope;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: 100,
    example: 'dining',
    description:
      '`null` or left out for `platform`. Otherwise required: a category (`hotels`, `dining`, `trips`, `events`, `guides`) for `pillar`, a business id for `provider` (see `GET /admin/discount-codes/targets`), a listing id for `listing`.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  scopeId?: string | null;

  @ApiProperty({ example: '2026-08-20', description: 'First day it can be used, `YYYY-MM-DD` (a real day).' })
  @IsCalendarDate()
  startAt: string;

  @ApiProperty({
    example: '2026-09-20',
    description: 'Last day it can be used, `YYYY-MM-DD`. The same day as `startAt` or later.',
  })
  @IsNotBefore('startAt')
  @IsCalendarDate()
  endAt: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: COUPON_MAX_COUNT,
    example: 400,
    description: 'Most times the code can be used in total. `null` or left out: no limit.',
  })
  @IsLimit()
  maxRedemptions: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: COUPON_MAX_COUNT,
    example: 1,
    description: 'Most times one guest can use it. `null` or left out: no limit.',
  })
  @IsLimit()
  perGuestCap: number | null;

  @ApiProperty({ description: '`false` switches the code off without deleting it.' })
  @IsBoolean({ message: msg('validation.BOOLEAN') })
  @Required()
  enabled: boolean;
}

/** Something a code can be scoped to. */
export class CouponTargetDto implements CouponTarget {
  @ApiProperty({ enum: COUPON_TARGET_SCOPES }) scope: CouponTargetScope;
  @ApiProperty({ description: 'Send this as `scopeId`.' }) id: string;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'hotels',
    description: 'The category of a business, to tell similar names apart; `null` for a category.',
  })
  detail: string | null;
}

/** `GET /admin/discount-codes/targets?scope=&search=&limit=`. */
export class ListCouponTargetsQueryDto {
  @ApiProperty({
    enum: COUPON_TARGET_SCOPES,
    description: '`pillar` for the booking categories, `provider` for businesses.',
  })
  @IsOneOf(COUPON_TARGET_SCOPES, 'validation.COUPON_SCOPE')
  scope: CouponTargetScope;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'dar',
    description: 'Matches the name (English or Arabic), ignoring case. Empty means no search.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: COUPON_TARGETS_MAX_LIMIT,
    default: COUPON_TARGETS_DEFAULT_LIMIT,
    description: 'How many to return.',
  })
  @IsIntInRange({ min: 1, max: COUPON_TARGETS_MAX_LIMIT, optional: true })
  limit: number = COUPON_TARGETS_DEFAULT_LIMIT;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}
