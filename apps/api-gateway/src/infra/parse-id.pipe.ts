import { ParseUUIDPipe } from '@nestjs/common';
import { I18nValidationException } from 'nestjs-i18n';

/**
 * `@Param('id', ParseIdPipe)`: a malformed id becomes a normal VALIDATION_FAILED
 * response with a translated message on the `id` field (see AllExceptionsFilter).
 */
export const ParseIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new I18nValidationException([{ property: 'id', constraints: { isUuid: '' }, children: [] }]),
});
