import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  isEmail,
  IsIn,
  IsISO31661Alpha2,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { LOCALES, normalizeEmail, normalizePhone, THEMES, type Locale, type Theme } from '@turath/common';
import {
  ACCOUNT_TYPES,
  AUTH_CHANNELS,
  PROVIDER_TYPES,
  USER_ROLES,
  type AccountType,
  type AuthChannel,
  type ProviderType,
  type OtpDispatch,
  type SessionView,
  type UserRole,
  type UserView,
} from '@turath/contracts';

const E164 = /^\+[1-9]\d{6,14}$/;
const OTP = /^\d{6}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);
const toUpper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

/** Phone in national or international format → E.164, read with the sibling `phoneCountry`. */
const toPhoneForCountry = ({ value, obj }: { value: unknown; obj: { phoneCountry?: unknown } }) => {
  if (typeof value !== 'string') return value;
  const country = typeof obj.phoneCountry === 'string' ? obj.phoneCountry.trim().toUpperCase() : undefined;
  return normalizePhone(value, country) ?? value.trim();
};

/** Destination depends on the channel: E.164 phone (Syrian by default) or lower-case email. */
const toDestination = ({ value, obj }: { value: unknown; obj: { channel?: unknown } }) => {
  if (typeof value !== 'string') return value;
  return obj.channel === 'phone' ? (normalizePhone(value) ?? value.trim()) : normalizeEmail(value);
};

/** Validates `destination` against the rule for its sibling `channel` field. */
function IsDestination(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isDestination',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: (args: ValidationArguments) =>
          (args.object as { channel?: unknown }).channel === 'phone'
            ? msg('validation.PHONE')(args)
            : msg('validation.EMAIL')(args),
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const channel = (args.object as { channel?: unknown }).channel;
          if (channel === 'phone') return E164.test(value);
          if (channel === 'email') return isEmail(value);
          return true; // `channel` reports its own error
        },
      },
    });
}

/** Letters in any script (Arabic, Latin…) incl. diacritics, joined by spaces, hyphens, apostrophes or dots. */
const PERSON_NAME = /^[\p{L}\p{M}]+(?:[\s'’.-]+[\p{L}\p{M}]+)*\.?$/u;
const HAS_LETTER_AND_DIGIT = /^(?=.*\p{L})(?=.*\d)/u;
const OLDEST_BIRTH_DATE = '1900-01-01';

/** A YYYY-MM-DD date strictly before today and not before 1900. Format errors are reported by IsISO8601. */
function IsPastBirthDate(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isPastBirthDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options: { message: msg('validation.DATE_OF_BIRTH') },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const today = new Date().toISOString().slice(0, 10);
          return value >= OLDEST_BIRTH_DATE && value < today;
        },
      },
    });
}

/** `providerType` is required (and must be a known type) for providers, and must be left out for tourists. */
function IsProviderTypeForAccount(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isProviderTypeForAccount',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: (args: ValidationArguments) => {
          const { accountType } = args.object as { accountType?: unknown };
          if (accountType === 'TOURIST') return msg('validation.PROVIDER_TYPE_NOT_ALLOWED')(args);
          return args.value == null || args.value === ''
            ? msg('validation.REQUIRED')(args)
            : msg('validation.PROVIDER_TYPE')(args);
        },
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const { accountType } = args.object as { accountType?: unknown };
          if (accountType === 'PROVIDER') return (PROVIDER_TYPES as readonly unknown[]).includes(value);
          if (accountType === 'TOURIST') return value == null;
          return true; // `accountType` reports its own error
        },
      },
    });
}

// ───────────────────────────── requests ─────────────────────────────

// class-validator runs a property's rules bottom-up and, with `stopAtFirstError`,
// reports only the first failure. So each field lists its rules from most specific
// (top) to "required" (bottom): a missing field gets exactly one "required" message.
export class RegisterDto {
  @ApiProperty({
    enum: ACCOUNT_TYPES,
    example: 'TOURIST',
    description: '`TOURIST` books experiences. `PROVIDER` offers them (account role becomes `PROVIDER_OWNER`).',
  })
  @IsIn(ACCOUNT_TYPES, { message: msg('validation.ACCOUNT_TYPE') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  accountType: AccountType;

  @ApiProperty({
    enum: PROVIDER_TYPES,
    nullable: true,
    required: false,
    example: 'HOTEL',
    description:
      'Required when `accountType` is `PROVIDER`; leave it out (or send null) for `TOURIST`. ' +
      'Dropdown options with translated labels: `GET /api/v1/meta` → `providerTypes`.',
  })
  @IsProviderTypeForAccount()
  providerType?: ProviderType | null;

  @ApiProperty({
    example: 'Rami Haddad',
    minLength: 2,
    maxLength: 100,
    description: 'Full name. Letters in any language; spaces, hyphens, apostrophes and dots are allowed.',
  })
  @Transform(trim)
  @Matches(PERSON_NAME, { message: msg('validation.NAME') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @MinLength(2, { message: msg('validation.MIN_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  name: string;

  @ApiProperty({
    example: '1994-05-17',
    format: 'date',
    description: 'ISO date `YYYY-MM-DD`. Must be in the past and not before 1900-01-01.',
  })
  @IsPastBirthDate()
  @IsISO8601({ strict: true }, { message: msg('validation.DATE') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  dateOfBirth: string;

  @ApiProperty({ example: 'SY', description: 'Nationality as an ISO 3166-1 alpha-2 country code (case-insensitive).' })
  @Transform(toUpper)
  @IsISO31661Alpha2({ message: msg('validation.COUNTRY') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  nationality: string;

  @ApiProperty({
    example: 'SY',
    description: 'Country the phone number belongs to, ISO 3166-1 alpha-2. Used to read national-format numbers.',
  })
  @Transform(toUpper)
  @IsISO31661Alpha2({ message: msg('validation.COUNTRY') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  phoneCountry: string;

  @ApiProperty({
    example: '0944 123 456',
    description: 'Mobile number in national (`0944 123 456`) or international (`+963944123456`) format; stored as E.164.',
  })
  @Transform(toPhoneForCountry)
  @Matches(E164, { message: msg('validation.PHONE') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  phone: string;

  @ApiProperty({ example: 'rami.haddad@example.com', maxLength: 150, description: 'Stored lower-case.' })
  @Transform(toEmail)
  @MaxLength(150, { message: msg('validation.MAX_LENGTH') })
  @IsEmail({}, { message: msg('validation.EMAIL') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  email: string;

  @ApiProperty({
    example: 'Turath2026',
    minLength: 8,
    maxLength: 128,
    description: '8–128 characters with at least one letter and one number.',
  })
  @Matches(HAS_LETTER_AND_DIGIT, { message: msg('validation.PASSWORD_WEAK') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  @MinLength(8, { message: msg('validation.MIN_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  password: string;
}

export class LoginEmailDto {
  @ApiProperty({
    example: 'rami.haddad@example.com',
    maxLength: 150,
    description: 'The email used at signup (case-insensitive).',
  })
  @Transform(toEmail)
  @MaxLength(150, { message: msg('validation.MAX_LENGTH') })
  @IsEmail({}, { message: msg('validation.EMAIL') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  email: string;

  @ApiProperty({ example: 'Turath2026', maxLength: 128, description: 'The account password.' })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  password: string;
}

export class LoginPhoneDto {
  @ApiProperty({ example: 'SY', description: 'Country the phone number belongs to, ISO 3166-1 alpha-2.' })
  @Transform(toUpper)
  @IsISO31661Alpha2({ message: msg('validation.COUNTRY') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  phoneCountry: string;

  @ApiProperty({
    example: '0944 123 456',
    description: 'The number used at signup, in national (`0944 123 456`) or international (`+963944123456`) format.',
  })
  @Transform(toPhoneForCountry)
  @Matches(E164, { message: msg('validation.PHONE') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  phone: string;
}

export class LoginPhoneVerifyDto extends LoginPhoneDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code sent by SMS (or `devCode` while testing).' })
  @Transform(trim)
  @Matches(OTP, { message: msg('validation.OTP') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  code: string;
}

export class SendOtpDto {
  @ApiProperty({ enum: AUTH_CHANNELS, example: 'phone', description: 'Where the code goes: `phone` (SMS) or `email`.' })
  @IsIn(AUTH_CHANNELS, { message: msg('validation.CHANNEL') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  channel: AuthChannel;

  @ApiProperty({
    example: '0944 123 456',
    description:
      'For `phone`: the mobile number (national Syrian or international format). For `email`: the email address.',
  })
  @Transform(toDestination)
  @IsDestination()
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  destination: string;
}

export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code that was sent (or `devCode` while testing).' })
  @Transform(trim)
  @Matches(OTP, { message: msg('validation.OTP') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  code: string;
}

export class ForgotPasswordDto extends SendOtpDto {}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'Qm9vay1yZXNldC10b2tlbi1leGFtcGxlLTEyMzQ1Njc4OQ',
    maxLength: 200,
    description: 'The reset code from `POST /auth/password/forgot` (sent by SMS/email, or `devCode` while testing).',
  })
  @Transform(trim)
  @MaxLength(200, { message: msg('validation.RESET_TOKEN') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  token: string;

  @ApiProperty({
    example: 'NewTurath2026',
    minLength: 8,
    maxLength: 128,
    description: 'The new password: 8–128 characters with at least one letter and one number.',
  })
  @Matches(HAS_LETTER_AND_DIGIT, { message: msg('validation.PASSWORD_WEAK') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  @MinLength(8, { message: msg('validation.MIN_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  password: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: LOCALES, example: 'ar', description: 'Interface language. `ar` switches to right-to-left.' })
  @IsIn(LOCALES, { message: msg('validation.LOCALE') })
  @IsOptional()
  locale?: Locale;

  @ApiPropertyOptional({ enum: THEMES, example: 'dark', description: '`system` follows the device setting.' })
  @IsIn(THEMES, { message: msg('validation.THEME') })
  @IsOptional()
  theme?: Theme;
}

// ───────────────────────────── responses (Swagger) ─────────────────────────────

export class OtpDispatchDto implements OtpDispatch {
  @ApiProperty({ enum: AUTH_CHANNELS, description: 'Where the code was sent.' }) channel: AuthChannel;
  @ApiProperty({ example: '••• 456', description: 'Masked phone or email, safe to show on screen.' })
  destination: string;
  @ApiProperty({ example: 300, description: 'Seconds until the code expires.' }) expiresInSeconds: number;
  @ApiProperty({ example: 60, description: 'Seconds before another code can be requested.' }) resendInSeconds: number;
  @ApiPropertyOptional({
    example: '123456',
    description: 'Temporary, development only (`OTP_DEV_ECHO=true`): the code itself, until SMS/email delivery is live.',
  })
  devCode?: string;
}

export class UserDto implements UserView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Rami Haddad' }) fullName: string;
  @ApiProperty({ nullable: true, type: String, example: 'rami.haddad@example.com' }) email: string | null;
  @ApiProperty({ example: '+963944123456', description: 'E.164' }) phone: string;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) phoneCountry: string | null;
  @ApiProperty({ nullable: true, type: String, example: '1994-05-17' }) dateOfBirth: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) nationality: string | null;
  @ApiProperty({ enum: USER_ROLES, description: 'Tourists are `TOURIST`; provider signups are `PROVIDER_OWNER`.' })
  role: UserRole;
  @ApiProperty({ enum: PROVIDER_TYPES, nullable: true, description: 'Kind of business; null for tourists.' })
  providerType: ProviderType | null;
  @ApiProperty({ minimum: 0, maximum: 100, example: 100, description: 'Starts at 100; drops 30 per no-show.' })
  reliabilityScore: number;
  @ApiProperty({ enum: LOCALES, description: 'Saved interface language.' }) locale: Locale;
  @ApiProperty({ enum: THEMES, description: 'Saved theme.' }) theme: Theme;
  @ApiProperty({ description: 'The phone was confirmed with a code.' }) phoneVerified: boolean;
  @ApiProperty({ description: 'The email was confirmed with a code.' }) emailVerified: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Send as `Authorization: Bearer <accessToken>`.' }) accessToken: string;
  @ApiProperty({ example: 900, description: 'Seconds the access token stays valid.' }) accessTokenExpiresIn: number;
  @ApiProperty({ description: 'Long-lived token, returned with every sign-in (also set as an HttpOnly cookie).' })
  refreshToken: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt: string;
  @ApiProperty({ type: UserDto }) user: UserDto;
}

export class SessionDto implements SessionView {
  @ApiProperty({ format: 'uuid', description: 'Pass to `DELETE /auth/sessions/{id}` to sign that device out.' })
  id: string;
  @ApiProperty({ nullable: true, type: String, example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })
  userAgent: string | null;
  @ApiProperty({ nullable: true, type: String, example: '203.0.113.7' }) ip: string | null;
  @ApiProperty({ format: 'date-time', description: 'When this device signed in.' }) createdAt: string;
  @ApiProperty({ format: 'date-time', description: 'Last sign-in activity on this device.' }) lastUsedAt: string;
  @ApiProperty({ description: 'True for the device making this request.' }) current: boolean;
}

export class RevokedCountDto {
  @ApiProperty({ example: 2, description: 'How many other devices were signed out.' }) revoked: number;
}

export class PreferencesDto {
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty({ enum: THEMES }) theme: Theme;
  @ApiProperty({ enum: ['ltr', 'rtl'], description: 'Text direction for `locale` (`rtl` for Arabic).' })
  dir: 'ltr' | 'rtl';
}

export class OptionDto {
  @ApiProperty({ example: 'HOTEL', description: 'Value to send to the API.' }) code: string;
  @ApiProperty({ example: 'Hotel', description: 'Label in the request language.' }) label: string;
}

export class LocaleOptionDto extends OptionDto {
  @ApiProperty({ enum: ['ltr', 'rtl'] }) dir: 'ltr' | 'rtl';
}

export class MetaDto {
  @ApiProperty({ example: 'Turath' }) appName: string;
  @ApiProperty({ type: [LocaleOptionDto] }) locales: LocaleOptionDto[];
  @ApiProperty({ enum: LOCALES }) defaultLocale: Locale;
  @ApiProperty({ type: [OptionDto] }) themes: OptionDto[];
  @ApiProperty({ enum: THEMES }) defaultTheme: Theme;
  @ApiProperty({ type: [String], example: ['SYP', 'USD'] }) currencies: string[];
  @ApiProperty({ type: [OptionDto], description: 'Signup dropdown: Tourist / Provider.' }) accountTypes: OptionDto[];
  @ApiProperty({ type: [OptionDto], description: 'Signup dropdown for providers.' }) providerTypes: OptionDto[];
}

export class FieldErrorDto {
  @ApiProperty({ example: 'email' }) field: string;
  @ApiProperty({ type: [String], example: ['Enter a valid email address.'] }) messages: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'VALIDATION_FAILED', description: 'Stable code to switch on in the client.' }) code: string;
  @ApiProperty({ example: 'Some fields need your attention.', description: 'Translated (en / ar).' }) message: string;
  @ApiPropertyOptional({ type: [FieldErrorDto], description: 'Only for `VALIDATION_FAILED`: one message per field.' })
  errors?: FieldErrorDto[];
  @ApiProperty({ example: '/api/v1/auth/register' }) path: string;
  @ApiProperty({ format: 'date-time' }) timestamp: string;
}
