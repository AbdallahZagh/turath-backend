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
  AUTH_CHANNELS,
  USER_ROLES,
  type AuthChannel,
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

// ───────────────────────────── requests ─────────────────────────────

export class RegisterDto {
  @ApiProperty({ example: 'Rami Haddad' })
  @Transform(trim)
  @IsString({ message: msg('validation.STRING') })
  @MinLength(2, { message: msg('validation.MIN_LENGTH') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  name: string;

  @ApiProperty({ example: '1994-05-17', description: 'ISO date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true }, { message: msg('validation.DATE') })
  dateOfBirth: string;

  @ApiProperty({ example: 'SY', description: 'ISO 3166-1 alpha-2' })
  @Transform(toUpper)
  @IsISO31661Alpha2({ message: msg('validation.COUNTRY') })
  nationality: string;

  @ApiProperty({ example: 'SY', description: 'Country of the phone number, ISO 3166-1 alpha-2' })
  @Transform(toUpper)
  @IsISO31661Alpha2({ message: msg('validation.COUNTRY') })
  phoneCountry: string;

  @ApiProperty({ example: '0944 123 456', description: 'National or international format; stored as E.164' })
  @Transform(({ value, obj }: { value: unknown; obj: { phoneCountry?: string } }) =>
    typeof value === 'string' ? (normalizePhone(value, obj.phoneCountry) ?? value.trim()) : value,
  )
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  @Matches(E164, { message: msg('validation.PHONE') })
  phone: string;

  @ApiProperty({ example: 'rami.haddad@example.com' })
  @Transform(toEmail)
  @IsEmail({}, { message: msg('validation.EMAIL') })
  @MaxLength(150, { message: msg('validation.MAX_LENGTH') })
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString({ message: msg('validation.STRING') })
  @MinLength(8, { message: msg('validation.MIN_LENGTH') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  password: string;
}

export class LoginEmailDto {
  @ApiProperty({ example: 'rami.haddad@example.com' })
  @Transform(toEmail)
  @IsEmail({}, { message: msg('validation.EMAIL') })
  email: string;

  @ApiProperty()
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  password: string;
}

export class SendOtpDto {
  @ApiProperty({ enum: AUTH_CHANNELS, example: 'phone' })
  @IsIn(AUTH_CHANNELS, { message: msg('validation.ONE_OF') })
  channel: AuthChannel;

  @ApiProperty({ example: '0944 123 456', description: 'Phone (Syrian numbers by default) or email' })
  @Transform(toDestination)
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  @IsDestination()
  destination: string;
}

export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @Matches(OTP, { message: msg('validation.OTP') })
  code: string;
}

export class ForgotPasswordDto extends SendOtpDto {}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset link' })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  @MaxLength(200, { message: msg('validation.MAX_LENGTH') })
  token: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString({ message: msg('validation.STRING') })
  @MinLength(8, { message: msg('validation.MIN_LENGTH') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  password: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Mobile clients only. Web sends the HttpOnly cookie instead.' })
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(200, { message: msg('validation.MAX_LENGTH') })
  refreshToken?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES, { message: msg('validation.ONE_OF') })
  locale?: Locale;

  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES, { message: msg('validation.ONE_OF') })
  theme?: Theme;
}

// ───────────────────────────── responses (Swagger) ─────────────────────────────

export class OtpDispatchDto implements OtpDispatch {
  @ApiProperty({ enum: AUTH_CHANNELS }) channel: AuthChannel;
  @ApiProperty({ example: '••• 456' }) destination: string;
  @ApiProperty({ example: 300 }) expiresInSeconds: number;
  @ApiProperty({ example: 60 }) resendInSeconds: number;
  @ApiPropertyOptional({ description: 'Local development only (OTP_DEV_ECHO=true)' }) devCode?: string;
}

export class UserDto implements UserView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ nullable: true, type: String }) email: string | null;
  @ApiProperty({ example: '+963944123456' }) phone: string;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) phoneCountry: string | null;
  @ApiProperty({ nullable: true, type: String, example: '1994-05-17' }) dateOfBirth: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) nationality: string | null;
  @ApiProperty({ enum: USER_ROLES }) role: UserRole;
  @ApiProperty({ minimum: 0, maximum: 100 }) reliabilityScore: number;
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty({ enum: THEMES }) theme: Theme;
  @ApiProperty() phoneVerified: boolean;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 900 }) accessTokenExpiresIn: number;
  @ApiPropertyOptional({ description: 'Only returned when `X-Client-Type: mobile` is sent' }) refreshToken?: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt: string;
  @ApiProperty({ type: UserDto }) user: UserDto;
}

export class SessionDto implements SessionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true, type: String }) userAgent: string | null;
  @ApiProperty({ nullable: true, type: String }) ip: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) lastUsedAt: string;
  @ApiProperty() current: boolean;
}

export class PreferencesDto {
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty({ enum: THEMES }) theme: Theme;
  @ApiProperty({ enum: ['ltr', 'rtl'] }) dir: 'ltr' | 'rtl';
}

export class FieldErrorDto {
  @ApiProperty({ example: 'email' }) field: string;
  @ApiProperty({ type: [String], example: ['Enter a valid email address'] }) messages: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'VALIDATION_FAILED' }) code: string;
  @ApiProperty({ example: 'Some fields need your attention' }) message: string;
  @ApiPropertyOptional({ type: [FieldErrorDto] }) errors?: FieldErrorDto[];
  @ApiProperty({ example: '/api/v1/auth/register' }) path: string;
  @ApiProperty({ format: 'date-time' }) timestamp: string;
}
