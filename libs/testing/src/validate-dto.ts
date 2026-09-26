import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Runs a DTO's rules the way the global pipe does (transform, whitelist,
 * stop at the first failure) and returns `{ field: 'validation.KEY' }` for
 * each failing field. Nested fields use dotted paths.
 */
export async function validateDto(
  dto: new () => object,
  body: Record<string, unknown>,
): Promise<Record<string, string>> {
  const instance = plainToInstance(dto, body);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: true });

  const result: Record<string, string> = {};
  const walk = (list: typeof errors, parent = '') => {
    for (const error of list) {
      const field = parent ? `${parent}.${error.property}` : error.property;
      const [message] = Object.values(error.constraints ?? {});
      // i18nValidationMessage encodes messages as "validation.KEY|{args}".
      if (message) result[field] = message.split('|')[0];
      walk(error.children ?? [], field);
    }
  };
  walk(errors);
  return result;
}
