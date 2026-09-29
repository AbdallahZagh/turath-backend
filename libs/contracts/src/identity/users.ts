import type { Locale, Theme } from '@turath/common';

export const USER_ROLES = ['TOURIST', 'PROVIDER_STAFF', 'PROVIDER_OWNER', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** What someone signs up as. PROVIDER accounts are created with the PROVIDER_OWNER role. */
export const ACCOUNT_TYPES = ['TOURIST', 'PROVIDER'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Kind of business a provider runs (the signup dropdown). */
export const PROVIDER_TYPES = ['RESTAURANT', 'HOTEL', 'TRIP_AGENCY', 'EVENT_MANAGER', 'TOUR_GUIDE'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** A user as every API response shows it. Never includes the password. */
export type UserView = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  phoneCountry: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  role: UserRole;
  providerType: ProviderType | null;
  reliabilityScore: number;
  locale: Locale;
  theme: Theme;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
};

export type PreferencesUpdatePayload = { userId: string; locale?: Locale; theme?: Theme };
