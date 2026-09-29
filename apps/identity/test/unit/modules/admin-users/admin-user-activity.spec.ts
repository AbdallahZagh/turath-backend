import type { AdminUserView } from '@turath/contracts';
import { buildUserActivity } from '../../../../src/modules/admin-users/admin-user-activity.js';

const user = (accountEvents: AdminUserView['accountEvents']): AdminUserView => ({
  id: 'u1',
  name: { en: 'Tarek Qudsi', ar: 'طارق قدسي' },
  phone: '+963 988 334 119',
  email: null,
  reliability: 40,
  completedBookings: 0,
  joinedAt: '2026-05-09',
  locked: true,
  accountEvents,
});

describe('buildUserActivity', () => {
  it('is empty for an account that was never locked', () => {
    expect(buildUserActivity(user([]))).toEqual([]);
  });

  it('turns account events into account-channel timeline entries', () => {
    expect(buildUserActivity(user([{ at: '2026-08-21', kind: 'locked' }]))).toEqual([
      { id: 'u1_locked_2026-08-21_0', at: '2026-08-21', kind: 'locked', channels: ['account'] },
    ]);
  });

  it('lists the newest first, and the later step first on the same day', () => {
    const activity = buildUserActivity(
      user([
        { at: '2026-08-01', kind: 'locked' },
        { at: '2026-08-05', kind: 'locked' },
        { at: '2026-08-05', kind: 'unlocked' },
      ]),
    );

    expect(activity.map((event) => `${event.at} ${event.kind}`)).toEqual([
      '2026-08-05 unlocked',
      '2026-08-05 locked',
      '2026-08-01 locked',
    ]);
  });
});
