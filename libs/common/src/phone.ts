import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

/** Login screens only accept Syrian numbers, so that is the default region. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'SY';

/**
 * Normalises what the frontend sends (national format such as "0944 123 456",
 * or international "+963 944 123 456") to E.164. Returns null when invalid.
 */
export function normalizePhone(raw: string, country?: string): string | null {
  const region = (country?.toUpperCase() as CountryCode | undefined) ?? DEFAULT_PHONE_COUNTRY;
  const parsed = parsePhoneNumberFromString(raw.trim(), region);
  return parsed?.isValid() ? parsed.number : null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Same masking as the frontend's maskDestination(), so the OTP screen matches. */
export function maskDestination(channel: 'phone' | 'email', destination: string): string {
  if (channel === 'email') {
    const at = destination.indexOf('@');
    return at <= 1 ? destination : `${destination.slice(0, 1)}•••${destination.slice(at)}`;
  }
  const digits = destination.replace(/\D/g, '');
  return digits.length < 4 ? destination : `••• ${digits.slice(-3)}`;
}
