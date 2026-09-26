import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsDefined, IsIn, IsOptional } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsEmailAddress, IsOneOf, IsStrongPassword, IsText } from '@turath/common';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, type AdminPermission, type AdminRole } from '@turath/contracts';

// Hidden from Swagger, so these DTOs only carry validation.

/** A list of known permissions, no repeats. May be empty (e.g. a SUPER_ADMIN), but must be sent. */
const IsPermissionList = () =>
  applyDecorators(
    IsDefined({ message: msg('validation.REQUIRED') }),
    IsArray({ message: msg('validation.LIST') }),
    ArrayUnique({ message: msg('validation.NO_DUPLICATES') }),
    IsIn(ADMIN_PERMISSIONS, { each: true, message: msg('validation.ADMIN_PERMISSION') }),
  );

/** POST /admin/admins */
export class CreateAdminDto {
  @IsText({ min: 2, max: 100 })
  name: string;

  @IsOneOf(ADMIN_ROLES, 'validation.ADMIN_ROLE')
  role: AdminRole;

  @IsPermissionList()
  permissions: AdminPermission[];

  @IsEmailAddress()
  email: string;

  @IsStrongPassword({ minLength: 12 })
  password: string;
}

/** PATCH /admin/admins/:id — any subset of the fields, plus lock / unlock. */
export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  @IsOptional()
  @IsBoolean({ message: msg('validation.BOOLEAN') })
  locked?: boolean;
}
