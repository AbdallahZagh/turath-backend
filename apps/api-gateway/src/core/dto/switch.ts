import { applyDecorators } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { Required } from '@turath/common';

/** A switch: required, true or false. */
export const IsSwitch = () => applyDecorators(Required(), IsBoolean({ message: msg('validation.BOOLEAN') }));
