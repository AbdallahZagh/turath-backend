/** How the gateway reaches the identity service over RabbitMQ. */
export const IDENTITY_QUEUE = 'identity_queue';
export const IDENTITY_CLIENT = Symbol('IDENTITY_CLIENT');

/** Message patterns for users, sign-in, sessions and preferences. */
export const IdentityPatterns = {
  HEALTH: 'identity.health',
  REGISTER: 'identity.register',
  LOGIN_EMAIL: 'identity.login.email',
  OTP_SEND: 'identity.otp.send',
  OTP_VERIFY: 'identity.otp.verify',
  LOGOUT: 'identity.logout',
  LOGOUT_ALL: 'identity.logout.all',
  SESSIONS_LIST: 'identity.sessions.list',
  SESSIONS_REVOKE: 'identity.sessions.revoke',
  PASSWORD_FORGOT: 'identity.password.forgot',
  PASSWORD_RESET: 'identity.password.reset',
  ME: 'identity.me',
  PREFERENCES_UPDATE: 'identity.preferences.update',
} as const;

/** Message patterns for the guests (tourists) shown in the admin dashboard. */
export const AdminUserPatterns = {
  LIST: 'identity.admin.users.list',
  GET: 'identity.admin.users.get',
} as const;

/** Message patterns for review moderation in the admin dashboard. */
export const AdminReviewPatterns = {
  LIST: 'identity.admin.reviews.list',
  SET_STATUS: 'identity.admin.reviews.status',
} as const;

/** Message patterns for back-office (admin) accounts. */
export const AdminPatterns = {
  CREATE: 'identity.admin.create',
  LIST: 'identity.admin.list',
  GET: 'identity.admin.get',
  UPDATE: 'identity.admin.update',
  DELETE: 'identity.admin.delete',
} as const;
