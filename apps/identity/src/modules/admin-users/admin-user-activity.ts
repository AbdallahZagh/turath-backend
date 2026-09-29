import type { AdminUserActivityEvent, AdminUserView, UserActivityKind } from '@turath/contracts';

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

/**
 * The activity timeline, newest first (frontend `buildUserActivity`). Booking
 * events will join these once the booking service exists.
 */
export function buildUserActivity(user: AdminUserView): AdminUserActivityEvent[] {
  return user.accountEvents
    .map((event, index): AdminUserActivityEvent => ({
      id: `${user.id}_${event.kind}_${event.at}_${index}`,
      at: event.at,
      kind: event.kind,
      channels: ['account'],
    }))
    .sort((a, b) => b.at.localeCompare(a.at) || KIND_RANK[b.kind] - KIND_RANK[a.kind]);
}
