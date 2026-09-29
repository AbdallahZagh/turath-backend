import { normalizeEmail, normalizePhone } from '../phone.js';

/** class-transformer `@Transform` helpers: normalise input before it is validated. */
type TransformArgs = { value: unknown; obj: Record<string, unknown> };

export const trim = ({ value }: TransformArgs) => (typeof value === 'string' ? value.trim() : value);

export const toUpper = ({ value }: TransformArgs) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export const toEmail = ({ value }: TransformArgs) => (typeof value === 'string' ? normalizeEmail(value) : value);

/** National or international phone → E.164, read with the country in the sibling field. */
export const toPhoneFor =
  (countryField: string) =>
  ({ value, obj }: TransformArgs) => {
    if (typeof value !== 'string') return value;
    const country = obj[countryField];
    return (
      normalizePhone(value, typeof country === 'string' ? country.trim().toUpperCase() : undefined) ?? value.trim()
    );
  };

/** "12" → 12 (for query strings). Anything that isn't a whole number is left as is, so the integer check reports it. */
export const toInt = ({ value }: TransformArgs) =>
  typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
