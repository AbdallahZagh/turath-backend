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
});
