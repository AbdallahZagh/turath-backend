import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';

/** A required object, validated against its own class. Checks run in this order: present, an object, then its fields. */
export function IsNestedObject(type: new () => object) {
  return applyDecorators(
    IsDefined({ message: msg('validation.REQUIRED') }),
    IsObject({ message: msg('validation.OBJECT') }),
    ValidateNested(),
    Type(() => type),
  );
}
