import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BOOKING_CATEGORIES,
  BOOKING_STATUSES,
  USER_ACTIVITY_CHANNELS,
  USER_ACTIVITY_KINDS,
  type AdminUserAccountEvent,
  type AdminUserActivityEvent,
  type AdminUserBooking,
  type AdminUserDetailView,
  type AdminUserPage,
  type AdminUserView,
  type BookingCategory,
  type BookingStatus,
  type UserActivityChannel,
  type UserActivityKind,
} from '@turath/contracts';
import { AdminReviewDto } from '../../admin-reviews/dto/admin-review.dto.js';

/** The name in each language. */
export class LocalizedNameDto {
  @ApiProperty({ example: 'Rami Haddad' }) en: string;
  @ApiProperty({ example: 'رامي حداد' }) ar: string;
}

/** One lock / unlock in the account history. */
export class AdminUserAccountEventDto implements AdminUserAccountEvent {
  @ApiProperty({ example: '2026-08-21', description: 'Calendar day, `YYYY-MM-DD`.' }) at: string;
  @ApiProperty({ enum: ['locked', 'unlocked'] }) kind: 'locked' | 'unlocked';
}

/** One guest in `GET /admin/users`. Same shape as `AdminUser` in the frontend mock. */
export class AdminUserDto implements AdminUserView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({
    type: LocalizedNameDto,
    description: 'Until accounts store a name per language, both fall back to the name the guest signed up with.',
  })
  name: LocalizedNameDto;
  @ApiProperty({ example: '+963 933 441 208', description: 'International format with spaces.' }) phone: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'rami.haddad@example.com',
    description: 'Null for guests who signed up with a phone number only.',
  })
  email: string | null;
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 100,
    description: 'Integer score; starts at 100, −30 per no-show.',
  })
  reliability: number;
  @ApiProperty({ example: 0, description: 'Always `0` until the booking service exists.' }) completedBookings: number;
  @ApiProperty({ example: '2025-11-04', description: 'Day the account was created (UTC), `YYYY-MM-DD`.' })
  joinedAt: string;
  @ApiProperty({ description: 'True while the account is locked and cannot sign in.' }) locked: boolean;
  @ApiProperty({
    type: [AdminUserAccountEventDto],
    description: 'Empty for an unlocked account; a locked account has one `locked` entry with the day it was locked.',
  })
  accountEvents: AdminUserAccountEventDto[];
}

/** `GET /admin/users`: one page of guests. */
export class AdminUserPageDto implements AdminUserPage {
  @ApiProperty({ type: [AdminUserDto], description: 'The guests on this page, newest first.' })
  items: AdminUserDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 57, description: 'Guests across all pages.' }) total: number;
  @ApiProperty({ example: 3, description: '`0` when there are no guests.' }) totalPages: number;
}

/** When a booking takes place. */
export class BookingWhenDto {
  @ApiProperty({ example: '2026-08-28', description: 'Day, `YYYY-MM-DD`.' }) start: string;
  @ApiPropertyOptional({ example: '2026-08-31' }) end?: string;
  @ApiPropertyOptional({ example: '20:30' }) time?: string;
}

/** A booking in the guest's history. Same shape as `AdminBooking` in the frontend mock. */
export class AdminUserBookingDto implements AdminUserBooking {
  @ApiProperty({ example: 'bkg_01' }) id: string;
  @ApiProperty({ example: 'K7M2QX' }) code: string;
  @ApiProperty({ type: LocalizedNameDto }) guest: LocalizedNameDto;
  @ApiProperty({ example: '+963 933 441 208' }) phone: string;
  @ApiProperty({ type: LocalizedNameDto }) provider: LocalizedNameDto;
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({ type: BookingWhenDto }) when: BookingWhenDto;
  @ApiProperty({ example: 1350000 }) amountSyp: number;
  @ApiProperty({ enum: BOOKING_STATUSES }) status: BookingStatus;
  @ApiPropertyOptional({ example: 'OLDDAMASCUS10' }) couponCode?: string;
  @ApiPropertyOptional({ example: 150000 }) discountSyp?: number;
  @ApiPropertyOptional({ example: 1500000 }) originalAmountSyp?: number;
}

/** One line of the activity timeline. */
export class AdminUserActivityEventDto implements AdminUserActivityEvent {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111_locked_2026-08-21_0' }) id: string;
  @ApiProperty({ example: '2026-08-21', description: 'Day, `YYYY-MM-DD`.' }) at: string;
  @ApiProperty({ enum: USER_ACTIVITY_KINDS }) kind: UserActivityKind;
  @ApiProperty({ enum: USER_ACTIVITY_CHANNELS, isArray: true }) channels: UserActivityChannel[];
  @ApiPropertyOptional({ type: LocalizedNameDto }) provider?: LocalizedNameDto;
  @ApiPropertyOptional({ example: 180000 }) amountSyp?: number;
  @ApiPropertyOptional({ example: 'K7M2QX' }) bookingCode?: string;
}

/** `GET /admin/users/{id}`: everything the guest detail page shows. */
export class AdminUserDetailDto implements AdminUserDetailView {
  @ApiProperty({ type: AdminUserDto }) user: AdminUserDto;
  @ApiProperty({ type: [AdminUserBookingDto], description: 'Empty until the booking service exists.' })
  bookings: AdminUserBookingDto[];
  @ApiProperty({
    type: [AdminUserActivityEventDto],
    description: 'Newest first. Until bookings exist it holds only the lock / unlock events.',
  })
  activity: AdminUserActivityEventDto[];
  @ApiProperty({ type: [AdminReviewDto], description: 'Reviews about this guest, newest first.' })
  reviews: AdminReviewDto[];
}
