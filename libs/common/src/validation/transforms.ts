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
    return normalizePhone(value, typeof country === 'string' ? country.trim().toUpperCase() : undefined) ?? value.trim();
  };
