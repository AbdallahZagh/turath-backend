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

/** Message patterns for the bookings table and drawer in the admin dashboard. */
export const AdminBookingPatterns = {
  LIST: 'identity.admin.bookings.list',
  GET: 'identity.admin.bookings.get',
  SET_STATUS: 'identity.admin.bookings.status',
} as const;

/** Message patterns for the disputes page in the admin dashboard. */
export const AdminDisputePatterns = {
  LIST: 'identity.admin.disputes.list',
  GET: 'identity.admin.disputes.get',
  RESOLVE: 'identity.admin.disputes.resolve',
} as const;

/** Message patterns for the provider accounts (ledger) table and page in the admin dashboard. */
export const AdminLedgerPatterns = {
  LIST: 'identity.admin.ledger.list',
  GET: 'identity.admin.ledger.get',
} as const;

/** Message patterns for the fees page (exchange rate and commission rates) in the admin dashboard. */
export const AdminFeePatterns = {
  GET: 'identity.admin.fees.get',
  SAVE: 'identity.admin.fees.save',
} as const;

/** Message patterns for the heritage sites table and page in the admin dashboard. */
export const AdminHeritageSitePatterns = {
  LIST: 'identity.admin.heritage-sites.list',
  GET: 'identity.admin.heritage-sites.get',
  CREATE: 'identity.admin.heritage-sites.create',
  UPDATE: 'identity.admin.heritage-sites.update',
  DELETE: 'identity.admin.heritage-sites.delete',
} as const;

/** Message patterns for the categories, amenities and regions lists in the admin dashboard. */
export const AdminTaxonomyPatterns = {
  LIST: 'identity.admin.taxonomy.list',
  CREATE: 'identity.admin.taxonomy.create',
  UPDATE: 'identity.admin.taxonomy.update',
  MOVE: 'identity.admin.taxonomy.move',
  DELETE: 'identity.admin.taxonomy.delete',
} as const;

/** Message patterns for the Featured page (home page promotions) in the admin dashboard, and the live ones the home page shows. */
export const AdminFeaturedPatterns = {
  LIST: 'identity.admin.featured.list',
  GET: 'identity.admin.featured.get',
  CREATE: 'identity.admin.featured.create',
  UPDATE: 'identity.admin.featured.update',
  DELETE: 'identity.admin.featured.delete',
  TARGETS: 'identity.admin.featured.targets',
  SLOTS: 'identity.admin.featured.slots',
  SLOTS_SAVE: 'identity.admin.featured.slots.save',
  LIVE: 'identity.featured.live',
} as const;

/** Message patterns for the businesses table and detail page in the admin dashboard. */
export const AdminProviderPatterns = {
  LIST: 'identity.admin.providers.list',
  EXPORT: 'identity.admin.providers.export',
  GET: 'identity.admin.providers.get',
} as const;

/** Message patterns for back-office (admin) accounts. */
export const AdminPatterns = {
  CREATE: 'identity.admin.create',
  LIST: 'identity.admin.list',
  GET: 'identity.admin.get',
  UPDATE: 'identity.admin.update',
  DELETE: 'identity.admin.delete',
} as const;
