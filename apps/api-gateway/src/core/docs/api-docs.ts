import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto.js';

/**
 * Building blocks for Swagger docs. Each module keeps its own endpoint docs in
 * `<module>.docs.ts` as one decorator per endpoint (e.g. `@RegisterDocs()`),
 * built from these shared notes and responses.
 */

export const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, the \`locale\` cookie, \`x-lang\` or \`Accept-Language\`. Validation failures return \`400 VALIDATION_FAILED\` with one message per field in \`errors\`; switch on \`code\`, not on the text.`;

export const SESSION_NOTE = `**Response:** \`accessToken\` (send as \`Authorization: Bearer <token>\`, valid \`accessTokenExpiresIn\` seconds), \`refreshToken\` with \`refreshTokenExpiresAt\`, and the signed-in \`user\`. Web clients also get HttpOnly session cookies plus the \`locale\` / \`theme\` cookies, so they don't need to store the tokens themselves. Once the access token expires, sign in again.`;

export const SIGNED_IN_NOTE = `**Requires sign-in:** \`Authorization: Bearer <accessToken>\` (mobile / API clients) or the HttpOnly session cookie (web). Without it: \`401 UNAUTHORIZED\`; with an expired or signed-out session: \`401 SESSION_EXPIRED\`.`;

/** The Arabic section at the end of a description. */
export const rtl = (text: string) => `\n---\n\n<div dir="rtl">\n\n${text.trim()}\n\n</div>\n`;

/** 400 with field errors. Only for routes that validate a body or route param. */
export const ValidationErrorResponse = () =>
  ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: '`VALIDATION_FAILED` (one translated message per field)',
  });

/** 429 from the global (or a route's) rate limit. Put on every controller. */
export const RateLimited = () =>
  ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Rate limited; the message says how long to wait',
  });

/** Bearer auth + the 401 every signed-in route can return. */
export const SignedIn = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ type: ErrorResponseDto, description: '`UNAUTHORIZED` or `SESSION_EXPIRED`' }),
  );
