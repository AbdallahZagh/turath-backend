import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ERRORS_NOTE, rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { PreferencesDto } from './dto/preferences.dto.js';

/** Swagger docs for the language / theme preferences endpoints. */

const PREFERENCES_GET_DESCRIPTION = `
**Current language, text direction and theme.** Works signed in or not: values come from the \`locale\` and \`theme\` cookies, falling back to the request language and \`system\`.

${rtl(`
**اللغة واتجاه النص والمظهر الحالية.** تعمل مع تسجيل الدخول أو بدونه، وتُقرأ القيم من الكوكيز \`locale\` و\`theme\`.
`)}`;

const PREFERENCES_UPDATE_DESCRIPTION = `
**Changes the language and/or theme.** Both fields are optional; send only what changes.

| Field | Rule |
|---|---|
| \`locale\` | Optional. \`en\` or \`ar\` |
| \`theme\` | Optional. \`light\`, \`dark\` or \`system\` |

Sets the \`locale\` / \`theme\` cookies (read by the frontend). When signed in, the choice is also saved on the account and restored on other devices at sign-in. Returns the resulting preferences.

${ERRORS_NOTE}
${rtl(`
**تغيير اللغة و/أو المظهر.** كلا الحقلين اختياري. تُحفظ القيم في الكوكيز، وعند تسجيل الدخول تُحفظ أيضًا في الحساب لتنتقل إلى أجهزتك الأخرى.
`)}`;

export const GetPreferencesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Current language, text direction and theme', description: PREFERENCES_GET_DESCRIPTION }),
    ApiOkResponse({ type: PreferencesDto }),
  );

export const UpdatePreferencesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Change the language and/or theme (saved on the account when signed in)',
      description: PREFERENCES_UPDATE_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: PreferencesDto, description: 'Preferences after the change; cookies are set.' }),
  );
