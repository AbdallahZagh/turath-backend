import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { rtl } from '../../core/docs/api-docs.js';
import { MetaDto } from './dto/meta.dto.js';

/** Swagger docs for the app metadata endpoint. */

const META_DESCRIPTION = `
**App metadata for building the UI:** supported languages (with text direction), themes, currencies, and the signup dropdowns (\`accountTypes\`, \`providerTypes\`). Labels are translated into the request language.

Public. Cached for an hour per language.

${rtl(`
**بيانات التطبيق لبناء الواجهة:** اللغات المدعومة واتجاه النص والمظاهر والعملات وخيارات القوائم المنسدلة في التسجيل (نوع الحساب ونوع مزوّد الخدمة)، مع تسميات مترجمة حسب لغة الطلب.
`)}`;

export const MetaDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Languages, themes, currencies and signup dropdown options (translated labels)',
      description: META_DESCRIPTION,
    }),
    ApiOkResponse({ type: MetaDto }),
  );
