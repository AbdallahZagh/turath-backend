import type {
  AdminBooking,
  AdminUserActivityEvent,
  AdminUserView,
  BookingStatus,
  UserActivityKind,
} from '@turath/contracts';

/** Same-day events: the later step of the story comes first. */
const KIND_RANK: Record<UserActivityKind, number> = {
  placed: 0,
  confirmed: 1,
  checkedIn: 2,
  cancelled: 3,
  noShow: 4,
  disputed: 5,
  completed: 6,
  locked: 7,
  unlocked: 8,
};

const MONEY_STATUSES: ReadonlySet<BookingStatus> = new Set(['completed', 'noShow', 'disputed']);

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const notBefore = (iso: string, floor: string) => (iso < floor ? floor : iso);

/** The booking story as events. Steps are only invented as far as the status needs (frontend `eventsForBooking`). */
function eventsForBooking(booking: AdminBooking, joinedAt: string): AdminUserActivityEvent[] {
  const start = booking.when.start;
  const base = { provider: booking.provider, bookingCode: booking.code };
  const events: AdminUserActivityEvent[] = [
    {
      id: `${booking.id}_placed`,
      at: notBefore(shiftDay(start, -14), joinedAt),
      kind: 'placed',
      channels: ['bookings'],
      ...base,
    },
  ];

  if (booking.status !== 'pending') {
    events.push({
      id: `${booking.id}_confirmed`,
      at: notBefore(shiftDay(start, -10), joinedAt),
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
    at: booking.status === 'cancelled' ? notBefore(shiftDay(start, -2), joinedAt) : start,
    kind: booking.status,
    channels: money ? ['bookings', 'money'] : ['bookings'],
    ...base,
    ...(money && { amountSyp: booking.amountSyp }),
  });
  return events;
}

/**
 * The activity timeline, newest first (frontend `buildUserActivity`): the lock / unlock
 * history plus the story of each of the guest's bookings.
 */
export function buildUserActivity(user: AdminUserView, bookings: AdminBooking[] = []): AdminUserActivityEvent[] {
  const events = bookings.flatMap((booking) => eventsForBooking(booking, user.joinedAt));

  user.accountEvents.forEach((event, index) => {
    events.push({
      id: `${user.id}_${event.kind}_${event.at}_${index}`,
      at: event.at,
      kind: event.kind,
      channels: ['account'],
    });
  });

  return events.sort((a, b) => b.at.localeCompare(a.at) || KIND_RANK[b.kind] - KIND_RANK[a.kind]);
}
