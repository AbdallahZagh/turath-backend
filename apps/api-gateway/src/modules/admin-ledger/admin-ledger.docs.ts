import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminLedgerDetailDto, AdminLedgerPageDto } from './dto/admin-ledger.dto.js';

/** Swagger docs for the admin provider accounts API. */

const LIST_DESCRIPTION = `
**Lists provider accounts** for the accounts page (\`/admin/accounts\`), in the order they were opened, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (accounts matching the filters) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar of the page; they combine (all must match):

- \`category\`: \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`.
- \`standing\`: \`healthy\`, \`watch\`, \`grace\` or \`suspended\`.
- \`search\`: matches the provider name (English or Arabic), ignoring case.

Each item has the same shape as \`AdminLedgerRow\` in the frontend's \`lib/mock/adminLedger.ts\`: \`provider\` is \`{ en, ar }\`; \`accruedSyp\`, \`paidSyp\` and \`creditCeilingSyp\` are whole Syrian pounds; \`creditUsed\` is a fraction (\`0.42\` = 42%, above \`1\` means over the ceiling); \`lastSettledAt\` is \`YYYY-MM-DD\`. What is still owed is \`accruedSyp - paidSyp\` (never below 0).

A bad filter value, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No matches is \`200\` with \`total: 0\`, not an error.

**Caching:** pages are cached for up to 60 seconds and dropped as soon as any account changes.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**قائمة حسابات المزوّدين** لصفحة الحسابات (\`/admin/accounts\`)، بترتيب فتحها، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (الحسابات المطابقة للفلاتر) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر في الصفحة، وتُطبَّق معًا:

- \`category\`: \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`.
- \`standing\`: \`healthy\` أو \`watch\` أو \`grace\` أو \`suspended\`.
- \`search\`: يطابق اسم المزوّد (بالإنجليزية أو العربية) دون تمييز حالة الأحرف.

لكل عنصر نفس شكل \`AdminLedgerRow\` في الواجهة الأمامية: \`provider\` بصيغة \`{ en, ar }\`؛ \`accruedSyp\` و\`paidSyp\` و\`creditCeilingSyp\` بالليرة السورية كأعداد صحيحة؛ \`creditUsed\` نسبة (\`0.42\` = 42%، وما فوق \`1\` يعني تجاوز السقف)؛ \`lastSettledAt\` بصيغة \`YYYY-MM-DD\`. المتبقي هو \`accruedSyp - paidSyp\` (لا يقل عن 0).

قيمة فلتر غير صحيحة أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود نتائج يعيد \`200\` مع \`total: 0\` وليس خطأ.

**التخزين المؤقت:** تُخزَّن الصفحات حتى 60 ثانية وتُمسح فور تغيّر أي حساب.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const GET_DESCRIPTION = `
**One provider account** for the account page that opens from a row of the accounts table. The response has:

- \`ledger\`: the row, same shape as an item of \`GET /admin/accounts\`.
- \`statements\`: the settlement periods, same shape as \`AdminLedgerStatement\` in the frontend mock. When something is still owed, the first one is the open period (\`status\` \`due\`, or \`overdue\` when the account is in \`grace\` or \`suspended\` or the period began more than one cadence ago); after it come the last 6 paid periods, newest first, ending at \`lastSettledAt\`.
- \`providerId\`: the business, to link to \`GET /admin/providers/{id}\`. \`null\` when the account isn't linked to one.

A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 LEDGER_NOT_FOUND\`. The result is cached for up to 60 seconds.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**حساب مزوّد واحد** لصفحة الحساب التي تُفتح من صف في جدول الحسابات. تحتوي الاستجابة على:

- \`ledger\`: الصف، بنفس شكل عنصر \`GET /admin/accounts\`.
- \`statements\`: فترات التسوية، بنفس شكل \`AdminLedgerStatement\` في الواجهة الأمامية. عند وجود مبلغ مستحق يكون أولها الفترة المفتوحة (\`status\` هي \`due\`، أو \`overdue\` إذا كان الحساب في \`grace\` أو \`suspended\` أو بدأت الفترة قبل أكثر من دورة)؛ وبعدها آخر 6 فترات مدفوعة، الأحدث أولًا، تنتهي عند \`lastSettledAt\`.
- \`providerId\`: المنشأة، للربط مع \`GET /admin/providers/{id}\`. \`null\` إذا لم يكن الحساب مرتبطًا بمنشأة.

\`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 LEDGER_NOT_FOUND\`. تُخزَّن النتيجة حتى 60 ثانية.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const ListAdminLedgerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List provider accounts (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminLedgerPageDto,
      description: 'One page of accounts; `items` is `[]` past the last page.',
    }),
  );

export const GetAdminLedgerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One provider account with its statements', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam({ name: 'id', format: 'uuid', description: 'Account id from `GET /admin/accounts`.' }),
    ApiOkResponse({ type: AdminLedgerDetailDto }),
    ApiNotFoundResponse({
      type: ErrorResponseDto,
      description: '`LEDGER_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`',
    }),
  );
