import { Prisma } from '../../../../src/generated/prisma/client.js';
import type { LedgerAccount } from '../../../../src/generated/prisma/client.js';
import { toAdminLedgerRow, toDbStanding } from '../../../../src/modules/admin-ledger/ledger.mapper.js';

const account = (overrides: Partial<LedgerAccount> = {}): LedgerAccount =>
  ({
    id: '66666666-6666-4666-8666-666666666666',
    providerId: null,
    providerNameEn: 'Palmyra Dawn Walks',
    providerNameAr: 'مشاوير فجر تدمر',
    category: 'TRIPS',
    accruedSyp: 2_640_000,
    paidSyp: 400_000,
    creditCeilingSyp: 2_200_000,
    creditUsed: new Prisma.Decimal('1.0500'),
    cadence: 'WEEKLY',
    lastSettledAt: new Date('2026-08-04'),
    standing: 'GRACE',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-04T00:00:00.000Z'),
    ...overrides,
  }) as LedgerAccount;

describe('toAdminLedgerRow', () => {
  it('matches the shape of the frontend AdminLedgerRow', () => {
    expect(toAdminLedgerRow(account())).toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      provider: { en: 'Palmyra Dawn Walks', ar: 'مشاوير فجر تدمر' },
      category: 'trips',
      accruedSyp: 2_640_000,
      paidSyp: 400_000,
      creditCeilingSyp: 2_200_000,
      creditUsed: 1.05,
      cadence: 'weekly',
      lastSettledAt: '2026-08-04',
      standing: 'grace',
    });
  });

  it('maps every cadence and standing to its lower-case name', () => {
    expect(toAdminLedgerRow(account({ cadence: 'BIWEEKLY', standing: 'SUSPENDED' }))).toMatchObject({
      cadence: 'biweekly',
      standing: 'suspended',
    });
  });
});

describe('toDbStanding', () => {
  it('maps each standing to its database value', () => {
    expect((['healthy', 'watch', 'grace', 'suspended'] as const).map(toDbStanding)).toEqual([
      'HEALTHY',
      'WATCH',
      'GRACE',
      'SUSPENDED',
    ]);
  });
});
