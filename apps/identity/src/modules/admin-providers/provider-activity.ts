import type {
  AdminBooking,
  AdminProviderActivityEvent,
  AdminProviderView,
  BookingStatus,
  ProviderActivityChannel,
  ProviderActivityKind,
} from '@turath/contracts';

/** Same-day events: the later step of the story comes first. */
const KIND_RANK: Record<ProviderActivityKind, number> = {
  placed: 0,
  confirmed: 1,
  checkedIn: 2,
  cancelled: 3,
  noShow: 4,
  disputed: 5,
  completed: 6,
  settled: 7,
  submitted: 8,
  approved: 9,
  rejected: 10,
  suspended: 11,
  reinstated: 12,
  financeUpdated: 13,
};

const MONEY_STATUSES: ReadonlySet<BookingStatus> = new Set(['completed', 'noShow', 'disputed']);

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const notBefore = (iso: string, floor: string) => (iso < floor ? floor : iso);

/** The booking story as events. Bookings are only invented as far as their status needs (frontend `eventsForBooking`). */
function eventsForBooking(booking: AdminBooking, submittedAt: string): AdminProviderActivityEvent[] {
  const start = booking.when.start;
  const base = { guest: booking.guest, bookingCode: booking.code };
  const events: AdminProviderActivityEvent[] = [
    {
      id: `${booking.id}_placed`,
      at: notBefore(shiftDay(start, -14), submittedAt),
      kind: 'placed',
      channels: ['bookings'],
      ...base,
    },
  ];

  if (booking.status !== 'pending') {
    events.push({
      id: `${booking.id}_confirmed`,
      at: notBefore(shiftDay(start, -10), submittedAt),
      kind: 'confirmed',
      channels: ['bookings'],
      ...base,
    });
  }

  if (booking.status === 'checkedIn' || booking.status === 'completed') {
    events.push({ id: `${booking.id}_checkedIn`, at: start, kind: 'checkedIn', channels: ['bookings'], ...base });
  }

  // Pending and confirmed bookings have nothing after "confirmed"; a checked-in one is still in progress.
  if (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'checkedIn') return events;

  const money = MONEY_STATUSES.has(booking.status);
  events.push({
    id: `${booking.id}_${booking.status}`,
    at: booking.status === 'cancelled' ? notBefore(shiftDay(start, -2), submittedAt) : start,
    kind: booking.status,
    channels: money ? ['bookings', 'money'] : ['bookings'],
    ...base,
    ...(money && { amountSyp: booking.amountSyp }),
  });
  return events;
}

const accountChannels = (kind: string): ProviderActivityChannel[] =>
  kind === 'financeUpdated' ? ['account', 'money'] : ['account'];

/**
 * The activity timeline, newest first (frontend `buildProviderActivity`): the
 * account history plus the story of each booking. Settlements join these once
 * the ledger exists.
 */
export function buildProviderActivity(
  provider: Pick<AdminProviderView, 'id' | 'submittedAt' | 'accountEvents'>,
  bookings: AdminBooking[],
): AdminProviderActivityEvent[] {
  const events = bookings.flatMap((booking) => eventsForBooking(booking, provider.submittedAt));

  provider.accountEvents.forEach((event, index) => {
    events.push({
      id: `${provider.id}_${event.kind}_${event.at}_${index}`,
      at: event.at,
      kind: event.kind,
      channels: accountChannels(event.kind),
    });
  });

  return events.sort((a, b) => b.at.localeCompare(a.at) || KIND_RANK[b.kind] - KIND_RANK[a.kind]);
}
