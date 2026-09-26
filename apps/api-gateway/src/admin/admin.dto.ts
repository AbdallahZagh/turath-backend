import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { normalizeEmail } from '@turath/common';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, type AdminPermission, type AdminRole } from '@turath/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);

// Hidden from Swagger, so these DTOs only carry validation.

export class CreateAdminDto {
  @Transform(trim)
  @IsString({ message: msg('validation.STRING') })
  @MinLength(2, { message: msg('validation.MIN_LENGTH') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  name: string;

  @IsIn(ADMIN_ROLES, { message: msg('validation.ONE_OF') })
  role: AdminRole;

  @IsArray({ message: msg('validation.ONE_OF') })
  @ArrayUnique()
  @IsIn(ADMIN_PERMISSIONS, { each: true, message: msg('validation.ONE_OF') })
  permissions: AdminPermission[];

  @Transform(toEmail)
  @IsEmail({}, { message: msg('validation.EMAIL') })
  @MaxLength(150, { message: msg('validation.MAX_LENGTH') })
  email: string;

  @IsString({ message: msg('validation.STRING') })
  @MinLength(12, { message: msg('validation.MIN_LENGTH') })
  @MaxLength(128, { message: msg('validation.MAX_LENGTH') })
  password: string;
}

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  /** true locks the account, false unlocks it. */
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
