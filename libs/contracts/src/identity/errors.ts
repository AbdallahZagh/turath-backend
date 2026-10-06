import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '@turath/common';

/**
 * Errors the identity service returns. Messages (EN / AR) live in
 * i18n/{en,ar}/errors/identity.json. Throw with `rpcError(IdentityError.X)`.
 */
export const IdentityError = defineErrors('identity', {
  // sign-in
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  ACCOUNT_LOCKED: HttpStatus.FORBIDDEN,
  ACCOUNT_NOT_VERIFIED: HttpStatus.FORBIDDEN,
  SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,

  // signup / profile
  PHONE_TAKEN: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,

  // one-time codes and password reset
  OTP_INVALID: HttpStatus.BAD_REQUEST,
  OTP_EXPIRED: HttpStatus.BAD_REQUEST,
  OTP_TOO_MANY_ATTEMPTS: HttpStatus.TOO_MANY_REQUESTS,
  OTP_COOLDOWN: HttpStatus.TOO_MANY_REQUESTS,
  RESET_TOKEN_INVALID: HttpStatus.BAD_REQUEST,

  // back-office accounts
  ADMIN_NOT_FOUND: HttpStatus.NOT_FOUND,
  ADMIN_EMAIL_TAKEN: HttpStatus.CONFLICT,

  // review moderation
  REVIEW_NOT_FOUND: HttpStatus.NOT_FOUND,

  // booking management
  BOOKING_NOT_FOUND: HttpStatus.NOT_FOUND,
  BOOKING_STATUS_INVALID: HttpStatus.CONFLICT,
  BOOKING_STATUS_CHANGED: HttpStatus.CONFLICT,

  // dispute resolution
  DISPUTE_NOT_FOUND: HttpStatus.NOT_FOUND,
  DISPUTE_ALREADY_RESOLVED: HttpStatus.CONFLICT,

  // provider accounts (ledger)
  LEDGER_NOT_FOUND: HttpStatus.NOT_FOUND,

  // heritage sites
  HERITAGE_SITE_NOT_FOUND: HttpStatus.NOT_FOUND,

  // categories, amenities and regions
  TAXONOMY_TERM_NOT_FOUND: HttpStatus.NOT_FOUND,
  TAXONOMY_SLUG_TAKEN: HttpStatus.CONFLICT,
  TAXONOMY_KIND_MISMATCH: HttpStatus.BAD_REQUEST,
  TAXONOMY_LIMIT_REACHED: HttpStatus.CONFLICT,

  // featured promotions
  PROMOTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROMOTION_KIND_SLOT_MISMATCH: HttpStatus.BAD_REQUEST,
  PROMOTION_LINK_NOT_FOUND: HttpStatus.BAD_REQUEST,
  PROMOTION_LINK_UNAVAILABLE: HttpStatus.CONFLICT,
  FEATURED_SLOT_DISABLED: HttpStatus.CONFLICT,
  FEATURED_SLOT_AT_CAPACITY: HttpStatus.CONFLICT,

  // discount codes
  COUPON_NOT_FOUND: HttpStatus.NOT_FOUND,
  COUPON_CODE_TAKEN: HttpStatus.CONFLICT,
  COUPON_CODE_LOCKED: HttpStatus.CONFLICT,
  COUPON_SCOPE_INVALID: HttpStatus.BAD_REQUEST,
  COUPON_PROVIDER_NOT_FOUND: HttpStatus.BAD_REQUEST,

  // provider management
  PROVIDER_NOT_FOUND: HttpStatus.NOT_FOUND,
});
