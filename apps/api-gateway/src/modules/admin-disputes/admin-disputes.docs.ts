import { applyDecorators } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminDisputeDetailDto, AdminDisputePageDto } from './dto/admin-dispute.dto.js';

/** Swagger docs for the admin disputes API. */

const LIST_DESCRIPTION = `
**Lists disputes** for the disputes page, most recently opened first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (disputes matching the filters) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar of the page; they combine (all must match):

- \`category\`: \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`.
- \`status\`: \`open\`, \`resolvedGuest\` or \`resolvedProvider\`.
- \`search\`: matches the guest and provider names, the booking code and the text of the provider's and the tourist's claims (English or Arabic), ignoring case.

Each item has the same shape as \`AdminDispute\` in the frontend's \`lib/mock/adminDisputes.ts\`: \`guest\`, \`provider\`, \`providerClaim\`, \`touristClaim\` and \`notes\` are \`{ en, ar }\`; \`openedAt\` is \`YYYY-MM-DD\`; \`amountSyp\` is the amount in dispute in whole Syrian pounds; \`notes\` is \`{ "en": "", "ar": "" }\` until the dispute is resolved.

A bad filter value, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No matches is \`200\` with \`total: 0\`, not an error.

**Caching:** pages are cached for up to 60 seconds and dropped as soon as any dispute changes, so a resolution shows up on the next request.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**قائمة النزاعات** لصفحة النزاعات، الأحدث فتحًا أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (النزاعات المطابقة للفلاتر) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر في الصفحة، وتُطبَّق معًا:

- \`category\`: \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`.
- \`status\`: \`open\` أو \`resolvedGuest\` أو \`resolvedProvider\`.
- \`search\`: يطابق اسمَي الضيف والمزوّد ورمز الحجز ونص ادعاءَي المزوّد والسائح (بالإنجليزية أو العربية)، دون تمييز حالة الأحرف.

لكل عنصر نفس شكل \`AdminDispute\` في الواجهة الأمامية: \`guest\` و\`provider\` و\`providerClaim\` و\`touristClaim\` و\`notes\` بصيغة \`{ en, ar }\`؛ \`openedAt\` بصيغة \`YYYY-MM-DD\`؛ \`amountSyp\` المبلغ محل النزاع بالليرة السورية كعدد صحيح؛ و\`notes\` تكون \`{ "en": "", "ar": "" }\` إلى أن يُحسم النزاع.

قيمة فلتر غير صحيحة أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود نتائج يعيد \`200\` مع \`total: 0\` وليس خطأ.

**التخزين المؤقت:** تُخزَّن الصفحات حتى 60 ثانية وتُمسح فور تغيّر أي نزاع، فيظهر القرار في الطلب التالي.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const GET_DESCRIPTION = `
**One dispute** for the details drawer that opens from a row of the disputes page: everything in the row (same shape as an item of \`GET /admin/disputes\`) plus:

- \`createdAt\` / \`updatedAt\`: ISO 8601 timestamps.
- \`resolvedAt\`: when an admin resolved it (ISO 8601), or \`null\` while it is \`open\`.

A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 DISPUTE_NOT_FOUND\`. The result is cached for up to 60 seconds and dropped as soon as any dispute changes.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**نزاع واحد** للدرج الذي يُفتح من صف في صفحة النزاعات: كل ما في الصف (بنفس شكل عنصر \`GET /admin/disputes\`) بالإضافة إلى:

- \`createdAt\` / \`updatedAt\`: طوابع زمنية بصيغة ISO 8601.
- \`resolvedAt\`: وقت حسم المشرف للنزاع (ISO 8601)، أو \`null\` ما دام \`open\`.

\`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 DISPUTE_NOT_FOUND\`. تُخزَّن النتيجة حتى 60 ثانية وتُمسح فور تغيّر أي نزاع.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const RESOLVE_DESCRIPTION = `
**Resolves an open dispute** for the guest or for the provider and stores the admin's notes: the "resolve" actions of the drawer. Returns the dispute as \`GET /admin/disputes/{id}\` does, with the new \`status\`, the \`notes\` and \`resolvedAt\`.

- Body: \`{ "status": "resolvedGuest" | "resolvedProvider", "notes": { "en": "...", "ar": "..." } }\`. \`resolvedGuest\` means the guest is right, \`resolvedProvider\` that the provider is. \`open\` is not a valid decision. Nothing else is allowed in the body.
- \`notes\` must have both \`en\` and \`ar\`; either can be an empty string. Each is trimmed and can be up to 1000 characters.
- Repeating the decision already taken succeeds and changes nothing (the notes already stored are kept), so a repeated click is safe.
- Deciding the opposite way on a dispute that was already resolved, or losing a race with another admin who decided differently, gives \`409 DISPUTE_ALREADY_RESOLVED\`: reload the dispute to see the decision.
- A malformed \`id\`, a missing or unknown \`status\`, missing or too long notes, or extra fields give \`400 VALIDATION_FAILED\` with one translated message per field. An id that doesn't exist gives \`404 DISPUTE_NOT_FOUND\`.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**حسم نزاع مفتوح** لصالح الضيف أو المزوّد وحفظ ملاحظات المشرف: إجراءا الحسم في الدرج. يعيد النزاع بنفس شكل \`GET /admin/disputes/{id}\` مع \`status\` الجديدة و\`notes\` و\`resolvedAt\`.

- المحتوى: \`{ "status": "resolvedGuest" | "resolvedProvider", "notes": { "en": "...", "ar": "..." } }\`. \`resolvedGuest\` تعني أن الحق مع الضيف، و\`resolvedProvider\` أن الحق مع المزوّد. \`open\` ليست قرارًا صالحًا. ولا يُسمح بغير ذلك في المحتوى.
- يجب أن تحتوي \`notes\` على \`en\` و\`ar\` معًا، ويمكن أن يكون أيٌّ منهما نصًا فارغًا. يُقتطع كل منهما من الفراغات الزائدة ويصل إلى 1000 حرف.
- تكرار القرار المتخذ بالفعل ينجح دون أي تغيير (وتبقى الملاحظات المحفوظة)، فالنقر المتكرر آمن.
- اتخاذ القرار المعاكس في نزاع محسوم، أو خسارة سباق مع مشرف آخر قرر بشكل مختلف، يعيد \`409 DISPUTE_ALREADY_RESOLVED\`: أعد تحميل النزاع لرؤية القرار.
- \`id\` غير صالح أو \`status\` مفقودة أو غير معروفة أو ملاحظات مفقودة أو طويلة جدًا أو حقول إضافية تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. معرّف غير موجود يعيد \`404 DISPUTE_NOT_FOUND\`.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const NOT_FOUND = '`DISPUTE_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Dispute id from `GET /admin/disputes`.' };

export const ListAdminDisputesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List disputes (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminDisputePageDto,
      description: 'One page of disputes; `items` is `[]` past the last page.',
    }),
  );

export const GetAdminDisputeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One dispute for the details drawer', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminDisputeDetailDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const ResolveDisputeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Resolve a dispute for the guest or the provider', description: RESOLVE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminDisputeDetailDto, description: 'The dispute with its decision and notes.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
    ApiConflictResponse({
      type: ErrorResponseDto,
      description: '`DISPUTE_ALREADY_RESOLVED` (it was already resolved the other way)',
    }),
  );
