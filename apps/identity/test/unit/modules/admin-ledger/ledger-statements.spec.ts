import type { AdminLedgerRow } from '@turath/contracts';
import { buildLedgerStatements, outstandingSyp } from '../../../../src/modules/admin-ledger/ledger-statements.js';

const row = (overrides: Partial<AdminLedgerRow> = {}): AdminLedgerRow => ({
  id: 'ldg',
  provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
  category: 'hotels',
  accruedSyp: 4_820_000,
  paidSyp: 3_100_000,
  creditCeilingSyp: 15_000_000,
  creditUsed: 0.42,
  cadence: 'weekly',
  lastSettledAt: '2026-08-25',
  standing: 'healthy',
  ...overrides,
});

const TODAY = '2026-09-01';

describe('outstandingSyp', () => {
  it('is what is still owed, never negative', () => {
    expect(outstandingSyp(row())).toBe(1_720_000);
    expect(outstandingSyp(row({ paidSyp: 9_000_000 }))).toBe(0);
  });
});

describe('buildLedgerStatements', () => {
  it('opens a due period for what is owed, then six paid periods ending at the last settlement', () => {
    const statements = buildLedgerStatements(row(), TODAY);

    expect(statements).toHaveLength(7);
    expect(statements[0]).toEqual({
      id: 'ldg_st_open',
      periodStart: '2026-08-26',
      periodEnd: TODAY,
      accruedSyp: 1_720_000,
      paidSyp: 0,
      status: 'due',
    });
    expect(statements[1]).toEqual({
      id: 'ldg_st_2026-08-25',
      periodStart: '2026-08-19',
      periodEnd: '2026-08-25',
      accruedSyp: 516_670,
      paidSyp: 516_670,
      status: 'paid',
    });
    expect(statements[2]).toMatchObject({ periodStart: '2026-08-12', periodEnd: '2026-08-18', status: 'paid' });
  });

  it('shares what was paid between the paid periods without losing a pound', () => {
    const paid = buildLedgerStatements(row(), TODAY).filter((s) => s.status === 'paid');

    expect(paid.reduce((sum, s) => sum + s.paidSyp, 0)).toBe(3_100_000);
  });

  it('has no open period when nothing is owed, and zero amounts when nothing was paid', () => {
    const settled = buildLedgerStatements(row({ paidSyp: 4_820_000 }), TODAY);
    const unpaid = buildLedgerStatements(row({ paidSyp: 0 }), TODAY);

    expect(settled).toHaveLength(6);
    expect(settled.every((s) => s.status === 'paid')).toBe(true);
    expect(unpaid.slice(1).every((s) => s.paidSyp === 0 && s.accruedSyp === 0)).toBe(true);
  });

  it('marks the open period overdue when it began more than one cadence ago', () => {
    expect(buildLedgerStatements(row({ lastSettledAt: '2026-08-20' }), TODAY)[0].status).toBe('overdue');
    expect(buildLedgerStatements(row({ lastSettledAt: '2026-08-20', cadence: 'monthly' }), TODAY)[0].status).toBe(
      'due',
    );
  });

  it.each(['grace', 'suspended'] as const)('marks the open period overdue for an account in %s', (standing) => {
    expect(buildLedgerStatements(row({ standing }), TODAY)[0].status).toBe('overdue');
  });

  it('never ends the open period before it starts', () => {
    expect(buildLedgerStatements(row({ lastSettledAt: '2026-09-05' }), TODAY)[0]).toMatchObject({
      periodStart: '2026-09-06',
      periodEnd: '2026-09-06',
    });
  });

  it('spaces the paid periods by the cadence', () => {
    const ends = (cadence: AdminLedgerRow['cadence']) =>
      buildLedgerStatements(row({ cadence, paidSyp: 4_820_000 }), TODAY)
        .slice(0, 2)
        .map((s) => s.periodEnd);

    expect(ends('biweekly')).toEqual(['2026-08-25', '2026-08-11']);
    expect(ends('monthly')).toEqual(['2026-08-25', '2026-07-26']);
  });
});
