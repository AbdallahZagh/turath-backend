import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { normalizeEmail } from '@turath/common';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, type AdminPermission, type AdminRole } from '@turath/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);
const HAS_LETTER_AND_DIGIT = /^(?=.*\p{L})(?=.*\d)/u;

// Hidden from Swagger, so these DTOs only carry validation.
// Rules run bottom-up and stop at the first failure (stopAtFirstError), so
// "required" sits at the bottom of each field.

export class CreateAdminDto {
  @Transform(trim)
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  @MinLength(2, { message: msg('validation.MIN_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  name: string;

  @IsIn(ADMIN_ROLES, { message: msg('validation.ADMIN_ROLE') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  role: AdminRole;

  /** May be empty (e.g. a SUPER_ADMIN), but must be sent. */
  @IsIn(ADMIN_PERMISSIONS, { each: true, message: msg('validation.ADMIN_PERMISSION') })
  @ArrayUnique({ message: msg('validation.NO_DUPLICATES') })
  @IsArray({ message: msg('validation.LIST') })
  @IsDefined({ message: msg('validation.REQUIRED') })
  permissions: AdminPermission[];

  @Transform(toEmail)
  @MaxLength(150, { message: msg('validation.MAX_LENGTH') })
  @IsEmail({}, { message: msg('validation.EMAIL') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  email: string;

  @Matches(HAS_LETTER_AND_DIGIT, { message: msg('validation.PASSWORD_WEAK') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  @MinLength(12, { message: msg('validation.MIN_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsNotEmpty({ message: msg('validation.REQUIRED') })
  password: string;
}

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  /** true locks the account, false unlocks it. */
  @IsBoolean({ message: msg('validation.BOOLEAN') })
  @IsOptional()
  locked?: boolean;
}
