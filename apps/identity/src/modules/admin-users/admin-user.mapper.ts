import { formatInternationalPhone } from '@turath/common';
import type { AdminUserAccountEvent, AdminUserView } from '@turath/contracts';
import type { User } from '../../generated/prisma/client.js';

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Only the current lock is stored, so the history is that one entry (or
 * nothing when the account isn't locked), like the frontend's seed data.
 */
function accountEvents(user: User): AdminUserAccountEvent[] {
  return user.lockedAt ? [{ at: day(user.lockedAt), kind: 'locked' }] : [];
}

/** Database row → one row of the admin guests list. Never includes the password hash. */
export function toAdminUserView(user: User): AdminUserView {
  return {
    id: user.id,
    name: { en: user.fullName, ar: user.fullName },
    phone: formatInternationalPhone(user.phone),
    email: user.email,
    reliability: user.reliabilityScore,
    completedBookings: 0,
    joinedAt: day(user.createdAt),
    locked: user.lockedAt !== null,
    accountEvents: accountEvents(user),
  };
}
