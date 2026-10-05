import type { AdminBooking, BookingStatus } from '@turath/contracts';
import { buildProviderActivity } from '../../../../src/modules/admin-providers/provider-activity.js';

const provider = {
  id: 'p1',
  submittedAt: '2026-06-12',
  accountEvents: [
    { at: '2026-06-12', kind: 'submitted' as const },
    { at: '2026-06-20', kind: 'approved' as const },
  ],
};

const booking = (status: BookingStatus, start = '2026-08-28'): AdminBooking => ({
  id: `bkg_${status}`,
  code: 'K7M2QX',
  guest: { en: 'Rami Haddad', ar: 'رامي حداد' },
  phone: '+963 933 441 208',
  provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
  category: 'hotels',
  when: { start },
  amountSyp: 1_000,
  status,
});

const kinds = (status: BookingStatus) =>
  buildProviderActivity({ ...provider, accountEvents: [] }, [booking(status)])
    .map((event) => event.kind)
    .reverse();

describe('buildProviderActivity', () => {
  it('lists the account history alone when there are no bookings, newest first', () => {
    expect(buildProviderActivity(provider, [])).toEqual([
      { id: 'p1_approved_2026-06-20_1', at: '2026-06-20', kind: 'approved', channels: ['account'] },
      { id: 'p1_submitted_2026-06-12_0', at: '2026-06-12', kind: 'submitted', channels: ['account'] },
    ]);
  });

  it('tells each booking as far as its status goes', () => {
    expect(kinds('pending')).toEqual(['placed']);
    expect(kinds('confirmed')).toEqual(['placed', 'confirmed']);
    expect(kinds('checkedIn')).toEqual(['placed', 'confirmed', 'checkedIn']);
    expect(kinds('completed')).toEqual(['placed', 'confirmed', 'checkedIn', 'completed']);
    expect(kinds('cancelled')).toEqual(['placed', 'confirmed', 'cancelled']);
    expect(kinds('noShow')).toEqual(['placed', 'confirmed', 'noShow']);
    expect(kinds('disputed')).toEqual(['placed', 'confirmed', 'disputed']);
  });

  it('puts completed, no-show and disputed bookings on the money channel with their amount', () => {
    const events = buildProviderActivity({ ...provider, accountEvents: [] }, [booking('completed')]);

    expect(events[0]).toMatchObject({
      kind: 'completed',
      channels: ['bookings', 'money'],
      amountSyp: 1_000,
      bookingCode: 'K7M2QX',
      guest: { en: 'Rami Haddad', ar: 'رامي حداد' },
    });
    expect(events.find((event) => event.kind === 'placed')).not.toHaveProperty('amountSyp');
  });

  it('dates booking events around the visit, never before the application', () => {
    const events = buildProviderActivity({ ...provider, accountEvents: [] }, [booking('cancelled', '2026-06-15')]);
    const at = Object.fromEntries(events.map((event) => [event.kind, event.at]));

    expect(at).toEqual({ placed: '2026-06-12', confirmed: '2026-06-12', cancelled: '2026-06-13' });
  });

  it('orders same-day events with the later step first', () => {
    const events = buildProviderActivity({ ...provider, accountEvents: [] }, [booking('completed')]);

    expect(events.slice(0, 2).map((event) => event.kind)).toEqual(['completed', 'checkedIn']);
  });

  it('puts a finance update on both the account and money channels', () => {
    const [event] = buildProviderActivity(
      { ...provider, accountEvents: [{ at: '2026-07-02', kind: 'financeUpdated' }] },
      [],
    );

    expect(event.channels).toEqual(['account', 'money']);
  });
});
