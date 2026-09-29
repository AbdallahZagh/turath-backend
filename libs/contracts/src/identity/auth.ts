import type { Locale } from '@turath/common';
import type { AccountType, ProviderType, UserRole, UserView } from './users.js';

export const AUTH_CHANNELS = ['phone', 'email'] as const;
export type AuthChannel = (typeof AUTH_CHANNELS)[number];

/** Claims inside the 15-minute access token. `sid` ties it to a Redis session. */
export type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  sid: string;
};

/** Who is signing in, stored on the session (shown in the device list). */
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
  accountType: AccountType;
  /** Set only when accountType is PROVIDER. */
  providerType: ProviderType | null;
  locale: Locale;
};

export type LoginEmailPayload = { email: string; password: string; client: ClientInfo };

export type OtpSendPayload = { channel: AuthChannel; destination: string };

export type OtpVerifyPayload = OtpSendPayload & { code: string; client: ClientInfo };

export type PasswordForgotPayload = OtpSendPayload;

export type PasswordResetPayload = { token: string; password: string };

/** Where a one-time code was sent. `destination` is masked. */
export type OtpDispatch = {
  channel: AuthChannel;
  destination: string;
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Only present when OTP_DEV_ECHO=true (local development). */
  devCode?: string;
};

/** Every successful sign-in. */
export type AuthResult = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: UserView;
};
