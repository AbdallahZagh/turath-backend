import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { toEmail, toInt, toPhoneFor, toUpper, trim } from './transforms.js';

/**
 * Reusable field rules. Each one bundles the normalising transform and every
 * check for that kind of field, with a translated message per check
 * (keys in i18n/<lang>/validation.json).
 *
 * Rules are listed in the order they run: with the global `stopAtFirstError`
 * a field reports only its first failure, so "required" always comes first.
 * Use them as one-liners in DTOs:
 *
 *   @IsPersonName() name: string;
 *   @IsStrongPassword() password: string;
 */

export const E164 = /^\+[1-9]\d{6,14}$/;
export const OTP_CODE = /^\d{6}$/;
/** Letters in any script (Arabic, Latin…) incl. diacritics, joined by spaces, hyphens, apostrophes or dots. */
export const PERSON_NAME = /^[\p{L}\p{M}]+(?:[\s'’.-]+[\p{L}\p{M}]+)*\.?$/u;
export const HAS_LETTER_AND_DIGIT = /^(?=.*\p{L})(?=.*\d)/u;
const OLDEST_BIRTH_DATE = '1900-01-01';

/** The field must be present and not empty. */
export const Required = () => IsNotEmpty({ message: msg('validation.REQUIRED') });

/** Required text, trimmed, with a length range. */
export function IsText({ min = 1, max }: { min?: number; max: number }) {
  return applyDecorators(
    Transform(trim),
    Required(),
    IsString({ message: msg('validation.STRING') }),
    MinLength(min, { message: msg('validation.MIN_LENGTH') }),
    MaxLength(max, { message: msg('validation.MAX_LENGTH') }),
  );
}

/** A person's full name: 2–100 letters in any language. */
export function IsPersonName() {
  return applyDecorators(IsText({ min: 2, max: 100 }), Matches(PERSON_NAME, { message: msg('validation.NAME') }));
}

/** Required email, lower-cased, up to 150 characters. */
export function IsEmailAddress() {
  return applyDecorators(
    Transform(toEmail),
    Required(),
    IsEmail({}, { message: msg('validation.EMAIL') }),
    MaxLength(150, { message: msg('validation.MAX_LENGTH') }),
  );
}

/** A new password: `minLength`–128 characters with at least one letter and one number. */
export function IsStrongPassword({ minLength = 8 }: { minLength?: number } = {}) {
  return applyDecorators(
    Required(),
    IsString({ message: msg('validation.STRING') }),
    MinLength(minLength, { message: msg('validation.MIN_LENGTH') }),
    MaxLength(128, { message: msg('validation.MAX_LENGTH') }),
    Matches(HAS_LETTER_AND_DIGIT, { message: msg('validation.PASSWORD_WEAK') }),
  );
}

/** A password being checked at sign-in: no strength rule, so older passwords still work. */
export function IsPasswordInput() {
  return applyDecorators(
    Required(),
    IsString({ message: msg('validation.STRING') }),
    MaxLength(128, { message: msg('validation.MAX_LENGTH') }),
  );
}

/** ISO 3166-1 alpha-2 country code, case-insensitive (stored upper-case). */
export function IsCountryCode() {
  return applyDecorators(Transform(toUpper), Required(), IsISO31661Alpha2({ message: msg('validation.COUNTRY') }));
}

/** Mobile number in national or international format, normalised to E.164 using the country in `countryField`. */
export function IsPhoneFor(countryField = 'phoneCountry') {
  return applyDecorators(
    Transform(toPhoneFor(countryField)),
    Required(),
    Matches(E164, { message: msg('validation.PHONE') }),
  );
}

/** The 6-digit one-time code. */
export function IsOtpCode() {
  return applyDecorators(Transform(trim), Required(), Matches(OTP_CODE, { message: msg('validation.OTP') }));
}

/** `YYYY-MM-DD`, in the past, not before 1900. */
export function IsBirthDate() {
  return applyDecorators(
    Required(),
    IsISO8601({ strict: true }, { message: msg('validation.DATE') }),
    (target: object, propertyName: string | symbol) =>
      registerDecorator({
        name: 'isPastBirthDate',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { message: msg('validation.DATE_OF_BIRTH') },
        validator: {
          validate(value: unknown): boolean {
            if (typeof value !== 'string') return false;
            return value >= OLDEST_BIRTH_DATE && value < new Date().toISOString().slice(0, 10);
          },
        },
      }),
  );
}

/**
 * One of a fixed list. `messageKey` names the choices in plain words
 * (e.g. 'validation.LOCALE' → "Choose English (en) or Arabic (ar).").
 */
export function IsOneOf(values: readonly unknown[], messageKey: string, { optional = false } = {}) {
  return applyDecorators(optional ? IsOptional() : Required(), IsIn(values, { message: msg(messageKey) }));
}

/** A whole number from `min` to `max` (query strings such as `?page=2` are converted). */
export function IsIntInRange({ min, max, optional = false }: { min: number; max: number; optional?: boolean }) {
  return applyDecorators(
    Transform(toInt),
    optional ? IsOptional() : Required(),
    IsInt({ message: msg('validation.INTEGER') }),
    Min(min, { message: msg('validation.MIN_VALUE') }),
    Max(max, { message: msg('validation.MAX_VALUE') }),
  );
}

/** `YYYY-MM-DD`, a real calendar day (2026-02-30 is refused). Time of day is not allowed. */
export function IsCalendarDate() {
  return applyDecorators(
    Required(),
    IsString({ message: msg('validation.STRING') }),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: msg('validation.DATE') }),
    IsISO8601({ strict: true }, { message: msg('validation.DATE') }),
  );
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value);

/**
 * The value must not be earlier than the text value of another field of the same object
 * (`YYYY-MM-DD` days compare correctly as text). It says nothing when either one is not a `YYYY-MM-DD` day:
 * that field's own rules report it.
 */
export function IsNotBefore(otherField: string, messageKey = 'validation.DATE_RANGE') {
  return (target: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isNotBefore',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [otherField],
      options: { message: msg(messageKey) },
      validator: {
        validate(value: unknown, args): boolean {
          const other = (args?.object as Record<string, unknown> | undefined)?.[otherField];
          return !isDay(value) || !isDay(other) || value >= other;
        },
      },
    });
}

/**
 * The number must be greater than the number in another field of the same object. It says nothing
 * when either one is not a number: that field's own rules report it.
 */
export function IsGreaterThan(otherField: string, messageKey: string) {
  return (target: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isGreaterThan',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [otherField],
      options: { message: msg(messageKey) },
      validator: {
        validate(value: unknown, args): boolean {
          const other = (args?.object as Record<string, unknown> | undefined)?.[otherField];
          return typeof value !== 'number' || typeof other !== 'number' || value > other;
        },
      },
    });
}
