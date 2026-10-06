import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsOneOf, trim } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  LEDGER_STANDINGS,
  SETTLEMENT_CADENCES,
  SETTLEMENT_STATUSES,
  type AdminLedgerDetail,
  type AdminLedgerPage,
  type AdminLedgerRow,
  type AdminLedgerStatement,
  type BookingCategory,
  type LedgerStanding,
  type SettlementCadence,
  type SettlementStatus,
} from '@turath/contracts';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One provider account in the table. Same shape as `AdminLedgerRow` in the frontend mock. */
export class AdminLedgerRowDto implements AdminLedgerRow {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: LocalizedNameDto, description: 'The provider this account belongs to.' })
  provider: LocalizedNameDto;
  @ApiProperty({ enum: BOOKING_CATEGORIES }) category: BookingCategory;
  @ApiProperty({ example: 4820000, description: 'Commission earned so far, in whole Syrian pounds.' })
  accruedSyp: number;
  @ApiProperty({ example: 3100000, description: 'How much of it has been paid.' }) paidSyp: number;
  @ApiProperty({ example: 15000000, description: 'The most the provider may owe.' }) creditCeilingSyp: number;
  @ApiProperty({
    example: 0.42,
    description: 'Fraction of the ceiling in use (`0.42` = 42%). Above `1` means over the ceiling.',
  })
  creditUsed: number;
  @ApiProperty({ enum: SETTLEMENT_CADENCES, description: 'How often the provider settles.' })
  cadence: SettlementCadence;
  @ApiProperty({ example: '2026-08-25', description: 'Day of the last settlement, `YYYY-MM-DD`.' })
  lastSettledAt: string;
  @ApiProperty({
    enum: LEDGER_STANDINGS,
    description: '`healthy`, `watch` (credit mostly used), `grace` (over the ceiling) or `suspended`.',
  })
  standing: LedgerStanding;
}

/** One settlement period. Same shape as `AdminLedgerStatement` in the frontend mock. */
export class AdminLedgerStatementDto implements AdminLedgerStatement {
  @ApiProperty({ example: 'b1c2d3e4-0000-4000-8000-000000000000_st_open' }) id: string;
  @ApiProperty({ example: '2026-08-26', description: '`YYYY-MM-DD`' }) periodStart: string;
  @ApiProperty({ example: '2026-09-01', description: '`YYYY-MM-DD`' }) periodEnd: string;
  @ApiProperty({ example: 1720000 }) accruedSyp: number;
  @ApiProperty({ example: 0 }) paidSyp: number;
  @ApiProperty({ enum: SETTLEMENT_STATUSES, description: '`paid`, `due` or `overdue`.' }) status: SettlementStatus;
}

/** `GET /admin/accounts/{id}`: the account, its statements and the business. */
export class AdminLedgerDetailDto implements AdminLedgerDetail {
  @ApiProperty({ type: AdminLedgerRowDto }) ledger: AdminLedgerRowDto;
  @ApiProperty({
    type: [AdminLedgerStatementDto],
    description:
      'The open period first (only when something is still owed), then the last 6 paid periods, newest first.',
  })
  statements: AdminLedgerStatementDto[];
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'The business (`GET /admin/providers/{id}`), or null when the account is not linked to one.',
  })
  providerId: string | null;
}

/** `GET /admin/accounts`: one page of accounts. */
export class AdminLedgerPageDto implements AdminLedgerPage {
  @ApiProperty({ type: [AdminLedgerRowDto], description: 'The accounts on this page, in the order they were opened.' })
  items: AdminLedgerRowDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 12, description: 'Accounts matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 1, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/accounts?page=&limit=&category=&standing=&search=`. Everything is optional. */
export class ListLedgerQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_CATEGORIES, description: 'Only providers of this kind.' })
  @IsOneOf(BOOKING_CATEGORIES, 'validation.BOOKING_CATEGORY', { optional: true })
  category?: BookingCategory;

  @ApiPropertyOptional({ enum: LEDGER_STANDINGS, description: 'Only accounts in this standing.' })
  @IsOneOf(LEDGER_STANDINGS, 'validation.LEDGER_STANDING', { optional: true })
  standing?: LedgerStanding;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'beit',
    description: 'Matches the provider name (English or Arabic), ignoring case. Empty means no search.',
  })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  search?: string;
}
