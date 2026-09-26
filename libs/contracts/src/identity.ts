import type { Locale, Theme } from '@turath/common';

export const IDENTITY_QUEUE = 'identity_queue';
export const IDENTITY_CLIENT = Symbol('IDENTITY_CLIENT');

export const USER_ROLES = ['TOURIST', 'PROVIDER_STAFF', 'PROVIDER_OWNER', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_CHANNELS = ['phone', 'email'] as const;
export type AuthChannel = (typeof AUTH_CHANNELS)[number];

/** RabbitMQ message patterns handled by the identity service. */
export const IdentityPatterns = {
  HEALTH: 'identity.health',
  REGISTER: 'identity.register',
  LOGIN_EMAIL: 'identity.login.email',
  OTP_SEND: 'identity.otp.send',
  OTP_VERIFY: 'identity.otp.verify',
  TOKEN_REFRESH: 'identity.token.refresh',
  LOGOUT: 'identity.logout',
  LOGOUT_ALL: 'identity.logout.all',
  SESSIONS_LIST: 'identity.sessions.list',
  SESSIONS_REVOKE: 'identity.sessions.revoke',
  PASSWORD_FORGOT: 'identity.password.forgot',
  PASSWORD_RESET: 'identity.password.reset',
  ME: 'identity.me',
  PREFERENCES_UPDATE: 'identity.preferences.update',
} as const;

/** Claims inside the 15-minute access token. `sid` ties it to a Redis session. */
export type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  sid: string;
};

export type ClientInfo = {
  ip?: string;
  userAgent?: string;
};

export type RegisterPayload = {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  phone: string;
  phoneCountry: string;
  email: string;
  password: string;
  locale: Locale;
};

export type LoginEmailPayload = { email: string; password: string };

export type OtpSendPayload = { channel: AuthChannel; destination: string };

export type OtpVerifyPayload = OtpSendPayload & { code: string; client: ClientInfo };

export type RefreshPayload = { refreshToken: string; client: ClientInfo };

export type SessionRef = { userId: string; sessionId: string };

export type PasswordForgotPayload = OtpSendPayload;

export type PasswordResetPayload = { token: string; password: string };

export type PreferencesUpdatePayload = { userId: string; locale?: Locale; theme?: Theme };

/** Where a one-time code was sent. `destination` is masked. */
export type OtpDispatch = {
  channel: AuthChannel;
  destination: string;
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Only present when OTP_DEV_ECHO=true (local development). */
  devCode?: string;
};

export type UserView = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  phoneCountry: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  role: UserRole;
  reliabilityScore: number;
  locale: Locale;
  theme: Theme;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthResult = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: UserView;
};

export type SessionView = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};
