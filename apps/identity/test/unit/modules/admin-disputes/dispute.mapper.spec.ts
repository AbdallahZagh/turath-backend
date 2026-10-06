import { DISPUTE_STATUSES } from '@turath/contracts';
import type { Dispute } from '../../../../src/generated/prisma/client.js';
import {
  toAdminDispute,
  toAdminDisputeDetail,
  toApiStatus,
  toDbStatus,
} from '../../../../src/modules/admin-disputes/dispute.mapper.js';

const dispute = (overrides: Partial<Dispute> = {}): Dispute =>
  ({
    id: '55555555-5555-4555-8555-555555555555',
    bookingCode: 'Q8D3ZA',
    guestNameEn: 'Tarek Qudsi',
    guestNameAr: 'طارق قدسي',
    providerNameEn: 'Palmyra Dawn Walks',
    providerNameAr: 'مشاوير فجر تدمر',
    category: 'TRIPS',
    openedAt: new Date('2026-08-21'),
    amountSyp: 640_000,
    providerClaimEn: 'Guest never arrived at the meeting point.',
    providerClaimAr: 'الضيف لم يصل إلى نقطة اللقاء.',
    touristClaimEn: 'Guide was not at the pin; I waited 40 minutes.',
    touristClaimAr: 'الدليل لم يكن عند النقطة؛ انتظرت 40 دقيقة.',
    notesEn: '',
    notesAr: '',
    status: 'OPEN',
    resolvedAt: null,
    createdAt: new Date('2026-08-21T09:12:44.000Z'),
    updatedAt: new Date('2026-08-21T09:12:44.000Z'),
    ...overrides,
  }) as Dispute;

describe('toAdminDispute', () => {
  it('matches the shape of the frontend AdminDispute', () => {
    expect(toAdminDispute(dispute())).toEqual({
      id: '55555555-5555-4555-8555-555555555555',
      bookingCode: 'Q8D3ZA',
      guest: { en: 'Tarek Qudsi', ar: 'طارق قدسي' },
      provider: { en: 'Palmyra Dawn Walks', ar: 'مشاوير فجر تدمر' },
      category: 'trips',
      openedAt: '2026-08-21',
      amountSyp: 640_000,
      providerClaim: { en: 'Guest never arrived at the meeting point.', ar: 'الضيف لم يصل إلى نقطة اللقاء.' },
      touristClaim: {
        en: 'Guide was not at the pin; I waited 40 minutes.',
        ar: 'الدليل لم يكن عند النقطة؛ انتظرت 40 دقيقة.',
      },
      notes: { en: '', ar: '' },
      status: 'open',
    });
  });

  it('shows the notes and the resolved status', () => {
    const row = toAdminDispute(
      dispute({ status: 'RESOLVED_PROVIDER', notesEn: 'Weather was advisory.', notesAr: 'الطقس كان تحذيراً.' }),
    );

    expect(row.status).toBe('resolvedProvider');
    expect(row.notes).toEqual({ en: 'Weather was advisory.', ar: 'الطقس كان تحذيراً.' });
  });
});

describe('toAdminDisputeDetail', () => {
  it('adds the timestamps, with resolvedAt null while open', () => {
    expect(toAdminDisputeDetail(dispute())).toMatchObject({
      bookingCode: 'Q8D3ZA',
      createdAt: '2026-08-21T09:12:44.000Z',
      updatedAt: '2026-08-21T09:12:44.000Z',
      resolvedAt: null,
    });
  });

  it('shows when it was resolved', () => {
    const resolvedAt = new Date('2026-08-25T10:00:00.000Z');

    expect(toAdminDisputeDetail(dispute({ status: 'RESOLVED_GUEST', resolvedAt })).resolvedAt).toBe(
      '2026-08-25T10:00:00.000Z',
    );
  });
});

describe('status map', () => {
  it.each(DISPUTE_STATUSES)('round-trips the %s status', (status) => {
    expect(toApiStatus(toDbStatus(status))).toBe(status);
  });
});
