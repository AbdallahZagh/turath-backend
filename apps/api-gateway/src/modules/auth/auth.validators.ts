import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { isEmail, registerDecorator, type ValidationArguments } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { E164, normalizeEmail, normalizePhone, Required } from '@turath/common';
import { PROVIDER_TYPES } from '@turath/contracts';

/**
 * Validation rules that only make sense for the auth API, because they depend
 * on another field of the same request. Shared field rules live in
 * @turath/common (IsPersonName, IsStrongPassword, …).
 */

/** `destination` is a phone or an email depending on the sibling `channel`. */
export function IsDestination() {
  return applyDecorators(
    Transform(({ value, obj }: { value: unknown; obj: { channel?: unknown } }) => {
      if (typeof value !== 'string') return value;
      return obj.channel === 'phone' ? (normalizePhone(value) ?? value.trim()) : normalizeEmail(value);
    }),
    Required(),
    (target: object, propertyName: string | symbol) =>
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
      }),
  );
}

/** `providerType` is required (and must be known) for providers, and must be left out for tourists. */
export function IsProviderTypeForAccount() {
  return (target: object, propertyName: string | symbol) =>
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
