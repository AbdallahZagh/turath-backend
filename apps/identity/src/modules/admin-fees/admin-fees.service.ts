import { Injectable } from '@nestjs/common';
import {
  COMMISSION_CATEGORIES,
  DEFAULT_COMMISSION_RATES,
  DEFAULT_SYP_PER_USD,
  type AdminFees,
  type AdminFeesSavePayload,
  type BookingCategory,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { toDbCategory } from '../admin-bookings/booking.mapper.js';
import { AdminFeesCache } from './admin-fees.cache.js';

/** The settings are one row, so they have one fixed id. */
const SETTINGS_ID = 1;

/** Fee settings for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminFeesCache,
  ) {}

  /** The exchange rate and one commission rate per category. Anything never saved shows its default. */
  get(): Promise<AdminFees> {
    return this.cache.remember('current', () => this.read());
  }

  /** Saves everything on the page at once, all or nothing, and returns what is now stored. */
  async save({ sypPerUsd, rates }: AdminFeesSavePayload): Promise<AdminFees> {
    await this.prisma.$transaction([
      this.prisma.feeSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, sypPerUsd },
        update: { sypPerUsd },
      }),
      ...COMMISSION_CATEGORIES.map((category) =>
        this.prisma.commissionRate.upsert({
          where: { category: toDbCategory(category) },
          create: { category: toDbCategory(category), rate: rates[category] },
          update: { rate: rates[category] },
        }),
      ),
    ]);
    await this.cache.invalidate();
    return this.read();
  }

  private async read(): Promise<AdminFees> {
    const [settings, stored] = await this.prisma.$transaction([
      this.prisma.feeSettings.findUnique({ where: { id: SETTINGS_ID } }),
      this.prisma.commissionRate.findMany(),
    ]);
    const saved = new Map<string, number>(stored.map((row) => [row.category, row.rate.toNumber()]));

    return {
      sypPerUsd: settings?.sypPerUsd ?? DEFAULT_SYP_PER_USD,
      rows: COMMISSION_CATEGORIES.map((category: BookingCategory) => ({
        category,
        rate: saved.get(toDbCategory(category)) ?? DEFAULT_COMMISSION_RATES[category],
      })),
    };
  }
}
