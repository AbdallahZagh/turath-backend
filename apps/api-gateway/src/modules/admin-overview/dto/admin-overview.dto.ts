import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsIntInRange } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  GOVERNORATES,
  OVERVIEW_DEFAULT_DAYS,
  OVERVIEW_MAX_DAYS,
  OVERVIEW_MIN_DAYS,
  OVERVIEW_ORIGINS,
  type AdminCityNoShow,
  type AdminCommissionSlice,
  type AdminDailyVolume,
  type AdminOriginShare,
  type AdminOverview,
  type AdminOverviewKpis,
  type AdminTopAttraction,
  type BookingCategory,
  type Governorate,
  type OverviewOrigin,
} from '@turath/contracts';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** `GET /admin/overview?days=`. */
export class OverviewQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: OVERVIEW_MIN_DAYS,
    maximum: OVERVIEW_MAX_DAYS,
    default: OVERVIEW_DEFAULT_DAYS,
    example: 30,
    description: 'The period, in days, counting back from today. The dashboard offers 7, 30 and 90.',
  })
  @IsIntInRange({ min: OVERVIEW_MIN_DAYS, max: OVERVIEW_MAX_DAYS, optional: true })
  days: number = OVERVIEW_DEFAULT_DAYS;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}

export class AdminOverviewKpisDto implements AdminOverviewKpis {
  @ApiProperty({
    example: 428_500_000,
    description: "Value of the period's bookings (by visit day), cancelled ones excluded.",
  })
  grossBookingsSyp: number;
  @ApiProperty({ example: 1842, description: 'Bookings of the period that were completed.' }) completedCount: number;
  @ApiProperty({
    example: 0.062,
    description: 'No-shows out of completed + no-show bookings, as a fraction; 0 when there are none.',
  })
  noShowRate: number;
  @ApiProperty({ example: 51_420_000, description: "Commission on the period's completed bookings." })
  commissionRevenueSyp: number;
  @ApiProperty({ example: 12, description: 'Businesses waiting for a decision right now.' }) pendingProviders: number;
  @ApiProperty({ example: 3, description: 'Disputes still open right now.' }) openDisputes: number;
}

export class AdminDailyVolumeDto implements AdminDailyVolume {
  @ApiProperty({ example: '2026-08-24', description: '`YYYY-MM-DD` (UTC).' }) date: string;
  @ApiProperty({ example: 54 }) count: number;
}

export class AdminCityNoShowDto implements AdminCityNoShow {
  @ApiProperty({ enum: GOVERNORATES }) governorate: Governorate;
  @ApiProperty({ example: 0.084, description: 'Fraction.' }) rate: number;
}

export class AdminOriginShareDto implements AdminOriginShare {
  @ApiProperty({ enum: OVERVIEW_ORIGINS }) id: OverviewOrigin;
  @ApiProperty({ example: 0.42, description: "Fraction of the period's guests." }) share: number;
}

export class AdminTopAttractionDto implements AdminTopAttraction {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'umayyad-mosque' }) slug: string;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({ enum: GOVERNORATES }) governorate: Governorate;
  @ApiProperty({ example: 4820, description: 'Visits counted in the period.' }) visits: number;
}

export class AdminCommissionSliceDto implements AdminCommissionSlice {
  @ApiProperty({ enum: BOOKING_CATEGORIES }) pillar: BookingCategory;
  @ApiProperty({ example: 22_400_000 }) amountSyp: number;
}

/** `GET /admin/overview`. */
export class AdminOverviewDto implements AdminOverview {
  @ApiProperty({ example: 30 }) periodDays: number;
  @ApiProperty({ type: AdminOverviewKpisDto }) kpis: AdminOverviewKpisDto;
  @ApiProperty({
    type: [AdminDailyVolumeDto],
    description: 'The latest 7 days, oldest first; days with no bookings are 0.',
  })
  volume: AdminDailyVolumeDto[];
  @ApiProperty({ type: [AdminCityNoShowDto], description: 'Highest rate first.' }) noShowByCity: AdminCityNoShowDto[];
  @ApiProperty({ type: [AdminOriginShareDto], description: 'Biggest share first, `other` last.' })
  origins: AdminOriginShareDto[];
  @ApiProperty({ type: [AdminTopAttractionDto], description: 'Up to five, most visited first.' })
  topAttractions: AdminTopAttractionDto[];
  @ApiProperty({
    type: [AdminCommissionSliceDto],
    description: 'Always the five kinds, in the order hotels, dining, trips, events, guides.',
  })
  commissionByPillar: AdminCommissionSliceDto[];
}
