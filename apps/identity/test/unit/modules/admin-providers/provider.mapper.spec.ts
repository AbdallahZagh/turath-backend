import { Prisma } from '../../../../src/generated/prisma/client.js';
import type { Provider, ProviderAccountEvent, ProviderDocument } from '../../../../src/generated/prisma/client.js';
import {
  fromDb,
  NO_RATING,
  ratingOf,
  toDb,
  toExportRow,
  toProviderSummary,
  toProviderView,
} from '../../../../src/modules/admin-providers/provider.mapper.js';

const provider = (overrides: Partial<Provider> = {}): Provider =>
  ({
    id: '66666666-6666-4666-8666-666666666666',
    nameEn: 'Beit Al-Wali',
    nameAr: 'بيت الوالي',
    ownerEn: 'Lina Nasser',
    ownerAr: 'لينا ناصر',
    category: 'HOTELS',
    governorate: 'DAMASCUS',
    status: 'APPROVED',
    submittedAt: new Date('2026-06-12'),
    phone: '+963939237227',
    email: 'lina.nasser@example.com',
    addressEn: 'Old Damascus',
    addressAr: 'دمشق القديمة',
    descriptionEn: 'Beit Al-Wali — Lina Nasser.',
    descriptionAr: 'بيت الوالي — لينا ناصر.',
    tier: 'HIGH_RISK',
    creditTier: 'ENTERPRISE',
    commissionOverride: new Prisma.Decimal('0.1000'),
    creditOverrideSyp: null,
    inventory: { kind: 'hotels', rooms: [] },
    createdAt: new Date('2026-08-27T12:00:00Z'),
    updatedAt: new Date('2026-08-27T12:00:00Z'),
    ...overrides,
  }) as Provider;

describe('enum names', () => {
  it.each([
    ['HIGH_RISK', 'highRisk'],
    ['COMMERCIAL_REGISTRATION', 'commercialRegistration'],
    ['FINANCE_UPDATED', 'financeUpdated'],
    ['PENDING', 'pending'],
  ])('%s ↔ %s', (db, api) => {
    expect(fromDb(db)).toBe(api);
    expect(toDb(api)).toBe(db);
  });
});

describe('toExportRow / toProviderSummary', () => {
  it('has the columns of the table', () => {
    expect(toExportRow(provider())).toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      name: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
      owner: { en: 'Lina Nasser', ar: 'لينا ناصر' },
      category: 'hotels',
      governorate: 'damascus',
      status: 'approved',
      submittedAt: '2026-06-12',
    });
  });

  it('adds the rating, or none', () => {
    expect(toProviderSummary(provider()).rating).toEqual({ average: 0, count: 0 });
    expect(toProviderSummary(provider(), { average: 4.5, count: 2 }).rating).toEqual({ average: 4.5, count: 2 });
  });
});

describe('toProviderView', () => {
  const documents = [
    { id: 'd1', kind: 'OWNER_ID', filename: 'id.jpg', uploadedAt: new Date('2026-06-12') },
  ] as ProviderDocument[];
  const accountEvents = [{ id: 'e1', kind: 'FINANCE_UPDATED', at: new Date('2026-07-02') }] as ProviderAccountEvent[];

  it('matches the shape of the frontend AdminProvider', () => {
    const view = toProviderView({ ...provider(), documents, accountEvents }, { average: 4, count: 3 });

    expect(view).toMatchObject({
      phone: '+963 939 237 227',
      email: 'lina.nasser@example.com',
      address: { en: 'Old Damascus', ar: 'دمشق القديمة' },
      description: { en: 'Beit Al-Wali — Lina Nasser.', ar: 'بيت الوالي — لينا ناصر.' },
      documents: [{ id: 'd1', kind: 'ownerId', filename: 'id.jpg', uploadedAt: '2026-06-12' }],
      tier: 'highRisk',
      creditTier: 'enterprise',
      commissionOverride: 0.1,
      creditOverrideSyp: null,
      inventory: { kind: 'hotels', rooms: [] },
      accountEvents: [{ at: '2026-07-02', kind: 'financeUpdated' }],
      rating: { average: 4, count: 3 },
    });
  });

  it('keeps a missing commission override null, and a zero one', () => {
    const none = toProviderView({ ...provider({ commissionOverride: null }), documents, accountEvents }, NO_RATING);
    const zero = toProviderView(
      { ...provider({ commissionOverride: new Prisma.Decimal(0) }), documents, accountEvents },
      NO_RATING,
    );

    expect(none.commissionOverride).toBeNull();
    expect(zero.commissionOverride).toBe(0);
  });
});

describe('ratingOf', () => {
  it('is the mean of the stars', () => {
    expect(ratingOf(14, 3)).toEqual({ average: 14 / 3, count: 3 });
  });

  it('is zero without reviews', () => {
    expect(ratingOf(0, 0)).toEqual({ average: 0, count: 0 });
  });
});
