import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProduces } from '@nestjs/swagger';
import { ADMIN_PROVIDER_EXPORT_LIMIT } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminProviderDetailDto, AdminProviderPageDto } from './dto/admin-provider.dto.js';

/** Swagger docs for the admin businesses API. */

const ERRORS_EN = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const FILTERS_EN = `- \`status\`: \`pending\`, \`approved\`, \`rejected\` or \`suspended\`.
- \`category\`: \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`.
- \`governorate\`: \`damascus\`, \`aleppo\`, \`latakia\`, \`tartus\`, \`homs\`, \`hama\`, \`palmyra\` or \`bosra\`.
- \`search\`: matches the business name and the owner (English or Arabic), ignoring case.`;
const FILTERS_AR = `- \`status\`: \`pending\` أو \`approved\` أو \`rejected\` أو \`suspended\`.
- \`category\`: \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`.
- \`governorate\`: \`damascus\` أو \`aleppo\` أو \`latakia\` أو \`tartus\` أو \`homs\` أو \`hama\` أو \`palmyra\` أو \`bosra\`.
- \`search\`: يطابق اسم المنشأة والمالك (بالإنجليزية أو العربية)، دون تمييز حالة الأحرف.`;

const LIST_DESCRIPTION = `
**Lists businesses** for the businesses table, in review order — pending applications first, then approved, rejected and suspended, each with the oldest submission first — one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (businesses matching the filters) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar of the page; they combine (all must match):

${FILTERS_EN}

Each item holds the columns of the table: \`id\`, \`name\`, \`owner\`, \`category\`, \`governorate\`, \`status\`, \`submittedAt\` and \`rating\` (\`average\` and \`count\` of the reviews about the business). The heavier parts of the frontend's \`AdminProvider\` (documents, inventory, history…) come with \`GET /admin/providers/{id}\`.

A bad filter value, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No matches is \`200\` with \`total: 0\`, not an error.

**Caching:** pages are cached for up to 60 seconds, and dropped as soon as a booking or review changes.

${API_KEY_NOTE}

${ERRORS_EN}
${rtl(`
**قائمة المنشآت** لجدول المنشآت بترتيب المراجعة — الطلبات المعلّقة أولًا ثم الموافق عليها والمرفوضة والموقّفة، والأقدم تقديمًا أولًا في كل مجموعة — صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (المنشآت المطابقة للفلاتر) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر في الصفحة، وتُطبَّق معًا:

${FILTERS_AR}

يحتوي كل عنصر على أعمدة الجدول: \`id\` و\`name\` و\`owner\` و\`category\` و\`governorate\` و\`status\` و\`submittedAt\` و\`rating\` (\`average\` و\`count\` للتقييمات عن المنشأة). الأجزاء الأثقل من \`AdminProvider\` في الواجهة (المستندات والمخزون والسجل…) تأتي مع \`GET /admin/providers/{id}\`.

قيمة فلتر غير صحيحة أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود نتائج يعيد \`200\` مع \`total: 0\` وليس خطأ.

**التخزين المؤقت:** تُخزَّن الصفحات حتى 60 ثانية وتُمسح فور تغيّر أي حجز أو تقييم.

${KEY_AR}

${ERRORS_AR}
`)}`;

const EXPORT_DESCRIPTION = `
**Downloads the businesses table as a CSV file** — the "Export CSV" button. It takes the same filters as \`GET /admin/providers\` (\`status\`, \`category\`, \`governorate\`, \`search\`) but **no paging**: every matching business is exported, in the same order as the table.

- Columns, in this order: Business, Owner, Category, Region, Status, Submitted. Headers and values are translated with the request language (\`?lang=ar\`, \`x-lang\` or \`Accept-Language\`); names follow the language too, and dates are written like \`Aug 22, 2026\`.
- The file is UTF-8 with a byte order mark, comma separated, with CRLF line ends, so Excel opens Arabic correctly. Text that would run as a spreadsheet formula (starting with \`=\`, \`+\`, \`-\` or \`@\`) gets a leading \`'\`.
- The response is \`text/csv\` with \`Content-Disposition: attachment; filename="turath-businesses-YYYY-MM-DD.csv"\`. It is never cached.
- At most ${ADMIN_PROVIDER_EXPORT_LIMIT} rows are exported. \`X-Export-Total\` says how many businesses matched and \`X-Export-Truncated\` is \`true\` when the file holds fewer.
- No matches gives a file with only the header row, not an error. A bad filter value or an unknown query parameter gives \`400 VALIDATION_FAILED\` (as JSON).

${API_KEY_NOTE}

${ERRORS_EN}
${rtl(`
**تنزيل جدول المنشآت كملف CSV** — زر «تصدير CSV». يقبل نفس فلاتر \`GET /admin/providers\` (\`status\` و\`category\` و\`governorate\` و\`search\`) لكن **دون ترقيم صفحات**: تُصدَّر كل المنشآت المطابقة بنفس ترتيب الجدول.

- الأعمدة بالترتيب: المنشأة، المالك، الفئة، المنطقة، الحالة، تاريخ التقديم. العناوين والقيم مترجمة بلغة الطلب (\`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`)، والأسماء تتبع اللغة أيضًا.
- الملف بترميز UTF-8 مع علامة BOM، مفصول بفواصل، وأسطره تنتهي بـ CRLF ليفتح Excel العربية بشكل صحيح. النص الذي قد يُنفَّذ كصيغة في جدول البيانات (يبدأ بـ \`=\` أو \`+\` أو \`-\` أو \`@\`) تُضاف إليه علامة \`'\` في البداية.
- الاستجابة \`text/csv\` مع \`Content-Disposition: attachment\`. لا تُخزَّن مؤقتًا.
- يُصدَّر ${ADMIN_PROVIDER_EXPORT_LIMIT} صفًا كحد أقصى. يبيّن \`X-Export-Total\` عدد المنشآت المطابقة، و\`X-Export-Truncated\` يساوي \`true\` عندما يحتوي الملف على أقل.
- عدم وجود نتائج يعيد ملفًا فيه صف العناوين فقط وليس خطأ. قيمة فلتر غير صحيحة أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` (بصيغة JSON).

${KEY_AR}

${ERRORS_AR}
`)}`;

const GET_DESCRIPTION = `
**One business** for its detail page, with the same parts as the frontend's \`AdminProviderDetailData\`:

- \`provider\`: everything about the business (same shape as \`AdminProvider\` in \`lib/mock/adminProviders.ts\`): contact details, \`address\`, \`description\`, \`documents\`, commission \`tier\` and \`creditTier\` with their overrides, \`inventory\` (its \`kind\` matches the category), \`accountEvents\` (oldest first) and \`rating\`.
- \`ledger\`: always \`null\` until the ledger exists.
- \`activity\`: the timeline, newest first — the account history plus the story of each of its bookings (placed, confirmed, checked in, completed, cancelled, no-show, disputed).
- \`reviews\`: the reviews about the business, newest first, in every moderation status.

A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 PROVIDER_NOT_FOUND\`. The result is cached for up to 60 seconds and dropped as soon as a booking or review changes.

${API_KEY_NOTE}

${ERRORS_EN}
${rtl(`
**منشأة واحدة** لصفحة تفاصيلها، بنفس أجزاء \`AdminProviderDetailData\` في الواجهة:

- \`provider\`: كل ما يخص المنشأة (بنفس شكل \`AdminProvider\`): بيانات التواصل و\`address\` و\`description\` و\`documents\` و\`tier\` للعمولة و\`creditTier\` مع الاستثناءات، و\`inventory\` (نوعه \`kind\` يطابق الفئة)، و\`accountEvents\` (الأقدم أولًا) و\`rating\`.
- \`ledger\`: دائمًا \`null\` إلى أن يوجد دفتر الحسابات.
- \`activity\`: الخط الزمني، الأحدث أولًا — سجل الحساب مع قصة كل حجز (إنشاء، تأكيد، وصول، اكتمال، إلغاء، عدم حضور، نزاع).
- \`reviews\`: التقييمات عن المنشأة، الأحدث أولًا، بكل حالات الإشراف.

\`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 PROVIDER_NOT_FOUND\`. تُخزَّن النتيجة حتى 60 ثانية وتُمسح فور تغيّر أي حجز أو تقييم.

${KEY_AR}

${ERRORS_AR}
`)}`;

const NOT_FOUND = '`PROVIDER_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';

export const ListAdminProvidersDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List businesses (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminProviderPageDto,
      description: 'One page of businesses; `items` is `[]` past the last page.',
    }),
  );

export const ExportAdminProvidersDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Export businesses as CSV', description: EXPORT_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiProduces('text/csv'),
    ApiOkResponse({
      description: 'The CSV file (UTF-8 with BOM).',
      schema: { type: 'string', format: 'binary', example: '﻿Business,Owner,Category,Region,Status,Submitted' },
      headers: {
        'Content-Disposition': {
          schema: { type: 'string' },
          description: 'attachment; filename="turath-businesses-YYYY-MM-DD.csv"',
        },
        'X-Export-Total': { schema: { type: 'integer' }, description: 'Businesses matching the filters.' },
        'X-Export-Truncated': {
          schema: { type: 'boolean' },
          description: '`true` when the file holds fewer than the total.',
        },
      },
    }),
  );

export const GetAdminProviderDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One business for the detail page', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam({ name: 'id', format: 'uuid', description: 'Business id from `GET /admin/providers`.' }),
    ApiOkResponse({ type: AdminProviderDetailDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );
