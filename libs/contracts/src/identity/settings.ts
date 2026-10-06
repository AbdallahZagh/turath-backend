import type { CreditTier } from './providers.js';
import type { FeaturedSlotId } from './featured.js';

export const OTP_CHANNELS = ['sms', 'whatsapp'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

/** Biggest credit ceiling, in whole Syrian pounds. */
export const MAX_CREDIT_CEILING_SYP = 1_000_000_000;

/**
 * The settings page. Same shape as `AdminSettings` in the frontend's `lib/mock/adminSettings.ts`.
 * `flags.featuringEnabled` and `flags.featuredSlots` are the home page featuring switches of
 * `GET /admin/featured/slots`: saving either one changes the other.
 */
export type AdminSettings = {
  /** Most a business on each credit tier can owe the platform, in whole Syrian pounds. */
  creditCeilingsSyp: Record<CreditTier, number>;
  reliability: {
    /** A guest's reliability score (0-100) at or above which they count as VIP. */
    vipAtOrAbove: number;
    standardAtOrAbove: number;
    restrictedAtOrAbove: number;
    /** Whether guests below the restricted cutoff are locked out. */
    lockSuspended: boolean;
  };
  flags: {
    /** How one-time codes are delivered to phones. */
    otpChannel: OtpChannel;
    /** Master switch for home page featuring. */
    featuringEnabled: boolean;
    /** Per-slot switch of the eight home page slots. */
    featuredSlots: Record<FeaturedSlotId, boolean>;
    webCheckIn: boolean;
  };
};

/** What the page shows until an admin saves. The scores must go down: VIP above standard above restricted. */
export const DEFAULT_SETTINGS = {
  creditCeilingsSyp: { new: 1_500_000, established: 5_000_000, enterprise: 15_000_000 },
  reliability: { vipAtOrAbove: 80, standardAtOrAbove: 50, restrictedAtOrAbove: 30, lockSuspended: true },
  otpChannel: 'sms',
  webCheckIn: true,
} as const satisfies {
  creditCeilingsSyp: Record<CreditTier, number>;
  reliability: AdminSettings['reliability'];
  otpChannel: OtpChannel;
  webCheckIn: boolean;
};
