import { applyDecorators } from '@nestjs/common';
import { ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, SIGNED_IN_NOTE, SignedIn, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { RevokedCountDto, SessionDto } from './dto/session.dto.js';

/** Swagger docs for sign-out and device (session) endpoints. */

const LOGOUT_DESCRIPTION = `
**Signs out this device.** The access token stops working immediately and the session cookies are cleared. Returns \`204 No Content\`.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من هذا الجهاز.** يتوقف رمز الوصول عن العمل فورًا وتُحذف كوكيز الجلسة.
`)}`;

const LOGOUT_OTHERS_DESCRIPTION = `
**Signs out every other device** on this account; this one stays signed in. Returns how many sessions were ended.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من جميع الأجهزة الأخرى** مع بقاء هذا الجهاز مسجّل الدخول. يعيد عدد الجلسات التي أُنهيت.
`)}`;

const SESSIONS_DESCRIPTION = `
**Lists the devices signed in to this account**, most recent first, with browser / app (\`userAgent\`), IP and times. \`current: true\` marks the device making the request.

${SIGNED_IN_NOTE}
${rtl(`
**قائمة الأجهزة المسجّلة الدخول إلى هذا الحساب** مع المتصفح أو التطبيق وعنوان IP والأوقات. الجهاز الحالي عليه \`current: true\`.
`)}`;

const SESSION_REVOKE_DESCRIPTION = `
**Signs out one device** using an \`id\` from \`GET /auth/sessions\`. Returns \`204 No Content\`.

A malformed id gives \`400 VALIDATION_FAILED\`; an id that isn't signed in on this account gives \`404 SESSION_NOT_FOUND\`.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من جهاز واحد** باستخدام المعرّف \`id\` من \`GET /auth/sessions\`.
`)}`;

export const LogoutDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Sign out this device', description: LOGOUT_DESCRIPTION }),
    SignedIn(),
    ApiNoContentResponse({ description: 'Signed out; session cookies cleared.' }),
  );

export const LogoutOthersDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Sign out every other device', description: LOGOUT_OTHERS_DESCRIPTION }),
    SignedIn(),
    ApiOkResponse({ type: RevokedCountDto }),
  );

export const ListSessionsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Devices signed in to this account', description: SESSIONS_DESCRIPTION }),
    SignedIn(),
    ApiOkResponse({ type: [SessionDto] }),
  );

export const RevokeSessionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Sign out one device', description: SESSION_REVOKE_DESCRIPTION }),
    SignedIn(),
    ValidationErrorResponse(),
    ApiParam({ name: 'id', format: 'uuid', description: 'Session id from `GET /auth/sessions`.' }),
    ApiNoContentResponse({ description: 'That device is signed out.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: '`SESSION_NOT_FOUND`' }),
  );
