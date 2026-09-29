import { applyDecorators } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiSecurity,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { RateLimited } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';

/** Building blocks for the back-office (`/admin/...`) endpoint docs. */

export const ADMIN_API_KEY_SCHEME = 'admin-api-key';

export const API_KEY_NOTE = `**Requires the back-office key:** send \`x-api-key: <key>\`. A missing or wrong key answers \`404 NOT_FOUND\`, exactly like an unknown route, so these routes can't be found by probing.`;

/** The header key every admin route needs, plus the errors it and the rate limit can give. */
export const AdminKeyRequired = () =>
  applyDecorators(
    RateLimited(),
    ApiSecurity(ADMIN_API_KEY_SCHEME),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: '`NOT_FOUND`: missing or wrong `x-api-key`' }),
    ApiServiceUnavailableResponse({
      type: ErrorResponseDto,
      description: '`SERVICE_UNAVAILABLE`: the identity service is down or slow',
    }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto, description: '`INTERNAL_ERROR`' }),
  );
