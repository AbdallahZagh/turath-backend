import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsNumber, IsObject, Max, Min, ValidateNested } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsIntInRange } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  MAX_SYP_PER_USD,
  type AdminCommissionRow,
  type AdminFees,
  type AdminFeesSavePayload,
  type BookingCategory,
} from '@turath/contracts';

/** One category's commission. Same shape as `AdminCommissionRow` in the frontend mock. */
export class AdminCommissionRowDto implements AdminCommissionRow {
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({ example: 0.12, minimum: 0, maximum: 1, description: 'A fraction: `0.12` is 12%.' }) rate: number;
}

/** `GET /admin/fees` and the result of saving. Same shape as `AdminCommissions` in the frontend mock. */
export class AdminFeesDto implements AdminFees {
  @ApiProperty({ example: 14286, description: 'Syrian pounds per one US dollar.' }) sypPerUsd: number;
  @ApiProperty({
    type: [AdminCommissionRowDto],
    description: 'One row per category, always in the order hotels, dining, trips, events, guides.',
  })
  rows: AdminCommissionRowDto[];
}

/** Every rate is a fraction from 0 to 1 with at most 4 decimals. Decorators run bottom-up, so "required" is last. */
const rateDoc = (example: number) => ({ example, minimum: 0, maximum: 1, description: 'A fraction: `0.12` is 12%.' });

/** The commission of each category. All five are required. */
export class CommissionRatesDto implements Record<BookingCategory, number> {
  @ApiProperty(rateDoc(0.12))
  @Max(1, { message: msg('validation.MAX_VALUE') })
  @Min(0, { message: msg('validation.MIN_VALUE') })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: msg('validation.RATE') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  hotels: number;

  @ApiProperty(rateDoc(0.12))
  @Max(1, { message: msg('validation.MAX_VALUE') })
  @Min(0, { message: msg('validation.MIN_VALUE') })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: msg('validation.RATE') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  dining: number;

  @ApiProperty(rateDoc(0.1))
  @Max(1, { message: msg('validation.MAX_VALUE') })
  @Min(0, { message: msg('validation.MIN_VALUE') })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: msg('validation.RATE') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  trips: number;

  @ApiProperty(rateDoc(0.12))
  @Max(1, { message: msg('validation.MAX_VALUE') })
  @Min(0, { message: msg('validation.MIN_VALUE') })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: msg('validation.RATE') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  events: number;

  @ApiProperty(rateDoc(0.085))
  @Max(1, { message: msg('validation.MAX_VALUE') })
  @Min(0, { message: msg('validation.MIN_VALUE') })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: msg('validation.RATE') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  guides: number;
}

/** `PUT /admin/fees`. Same shape as `SaveAdminCommissionsInput` in the frontend mock. */
export class SaveFeesDto implements AdminFeesSavePayload {
  @ApiProperty({
    example: 14286,
    minimum: 1,
    maximum: MAX_SYP_PER_USD,
    description: 'Syrian pounds per one US dollar, a whole number.',
  })
  @IsIntInRange({ min: 1, max: MAX_SYP_PER_USD })
  sypPerUsd: number;

  @ApiProperty({ type: CommissionRatesDto, description: 'The commission rate of every category.' })
  @Type(() => CommissionRatesDto)
  @ValidateNested()
  @IsObject({ message: msg('validation.OBJECT') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  rates: CommissionRatesDto;
}
