import { HttpStatus } from '@nestjs/common';

/**
 * One error a client can receive:
 *   code       stable, machine-readable; sent to clients, who switch on it
 *   status     the HTTP status it maps to
 *   namespace  where its message lives: i18n/<lang>/errors/<namespace>.json
 *
 * The API never sends raw English: the message is translated from that file.
 */
export type ErrorDef = {
  readonly namespace: string;
  readonly code: string;
  readonly status: HttpStatus;
};

/**
 * Declares a service's error catalogue. Each service keeps its own, next to
 * its contracts (e.g. `IdentityError` in libs/contracts/src/identity/errors.ts),
 * with the messages in `i18n/{en,ar}/errors/<namespace>.json`:
 *
 *   export const BookingError = defineErrors('booking', {
 *     SLOT_TAKEN: HttpStatus.CONFLICT,
 *   });
 *   throw rpcError(BookingError.SLOT_TAKEN);
 *
 * Codes must be unique across all catalogues (a unit test checks this).
 */
export function defineErrors<const T extends Record<string, HttpStatus>>(
  namespace: string,
  statuses: T,
): { readonly [K in keyof T & string]: ErrorDef & { readonly code: K } } {
  return Object.fromEntries(
    Object.entries(statuses).map(([code, status]) => [code, Object.freeze({ namespace, code, status })]),
  ) as { readonly [K in keyof T & string]: ErrorDef & { readonly code: K } };
}

/** Errors any service or the gateway itself can raise. */
export const CommonError = defineErrors('common', {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
});

const STATUS_FALLBACK: Partial<Record<number, ErrorDef>> = {
  400: CommonError.BAD_REQUEST,
  401: CommonError.UNAUTHORIZED,
  403: CommonError.FORBIDDEN,
  404: CommonError.NOT_FOUND,
  409: CommonError.CONFLICT,
  429: CommonError.TOO_MANY_REQUESTS,
  503: CommonError.SERVICE_UNAVAILABLE,
};

/** For framework errors that carry only a status (e.g. an unknown route). */
export function errorForStatus(status: number): ErrorDef {
  return STATUS_FALLBACK[status] ?? (status >= 500 ? CommonError.INTERNAL_ERROR : CommonError.BAD_REQUEST);
}

/** The i18n key of an error's message. */
export function errorMessageKey(error: Pick<ErrorDef, 'namespace' | 'code'>): string {
  return `errors.${error.namespace}.${error.code}`;
}
