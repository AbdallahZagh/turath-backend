import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsOneOf, trim } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  BOOKING_STATUSES,
  type AdminBooking,
  type AdminBookingDetail,
  type AdminBookingPage,
  type BookingCategory,
  type BookingStatus,
} from '@turath/contracts';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { BookingWhenDto, LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One booking in the table. Same shape as `AdminBooking` in the frontend mock. */
export class AdminBookingDto implements AdminBooking {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'K7M2QX', description: 'The 6-character code the guest shows on arrival.' }) code: string;
  @ApiProperty({ type: LocalizedNameDto }) guest: LocalizedNameDto;
  @ApiProperty({ example: '+963 933 441 208', description: 'International format with spaces.' }) phone: string;
  @ApiProperty({ type: LocalizedNameDto }) provider: LocalizedNameDto;
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({
    type: BookingWhenDto,
    description: '`start` always; `end` for stays; `time` (`HH:mm`, 24h) for dining, events and guides.',
  })
  when: BookingWhenDto;
  @ApiProperty({ example: 1350000, description: 'What the guest pays, in Syrian pounds, after any discount.' })
  amountSyp: number;
  @ApiProperty({ enum: BOOKING_STATUSES }) status: BookingStatus;
  @ApiPropertyOptional({ example: 'OLDDAMASCUS10', description: 'Only when a coupon was used.' }) couponCode?: string;
  @ApiPropertyOptional({ example: 150000, description: 'Only when a coupon was used.' }) discountSyp?: number;
  @ApiPropertyOptional({ example: 1500000, description: 'Price before the discount. Only when a coupon was used.' })
  originalAmountSyp?: number;
}

/** `GET /admin/bookings/{id}` and the result of changing the status: the table row plus what the drawer needs. */
export class AdminBookingDetailDto extends AdminBookingDto implements AdminBookingDetail {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: "The guest's account (`GET /admin/users/{id}`), or null when the booking isn't linked to one.",
  })
  guestId: string | null;
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: "The provider's account, or null until providers exist as accounts.",
  })
  providerId: string | null;
  @ApiProperty({ example: '2026-08-20T09:12:44.000Z', description: 'When the booking was placed.' })
  createdAt: string;
  @ApiProperty({ example: '2026-08-28T14:03:10.000Z', description: 'When the booking last changed.' })
  updatedAt: string;
}

/** `GET /admin/bookings`: one page of bookings. */
export class AdminBookingPageDto implements AdminBookingPage {
  @ApiProperty({ type: [AdminBookingDto], description: 'The bookings on this page, newest first.' })
  items: AdminBookingDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 57, description: 'Bookings matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 3, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/bookings?page=&limit=&category=&status=&search=`. Everything is optional. */
export class ListBookingsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_CATEGORIES, description: 'Only bookings of this kind.' })
  @IsOneOf(BOOKING_CATEGORIES, 'validation.BOOKING_CATEGORY', { optional: true })
  category?: BookingCategory;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES, description: 'Only bookings in this status.' })
  @IsOneOf(BOOKING_STATUSES, 'validation.BOOKING_STATUS', { optional: true })
  status?: BookingStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'rami',
    description:
      'Matches the guest or provider name (English or Arabic), the guest phone and the booking code, ignoring case. A phone can be typed with spaces or `+`. Empty means no search.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  search?: string;
}

/** `PATCH /admin/bookings/{id}/status` */
export class SetBookingStatusDto {
  @ApiProperty({ enum: BOOKING_STATUSES, description: 'The status to move the booking to.' })
  @IsOneOf(BOOKING_STATUSES, 'validation.BOOKING_STATUS')
  status: BookingStatus;
}
