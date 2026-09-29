import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminReviewDto, AdminReviewPageDto } from './dto/admin-review.dto.js';

/** Swagger docs for the admin review moderation API. */

const LIST_DESCRIPTION = `
**Lists reviews** for the moderation page, newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (reviews matching the filters) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar of the page; they combine (all must match):

- \`about\`: \`provider\` or \`guest\`.
- \`stars\`: \`1\` to \`5\`.
- \`status\`: \`published\`, \`flagged\` or \`hidden\`.
- \`search\`: matches the subject, author, review text (English or Arabic) and booking code, ignoring case.

Each item has the same shape as \`AdminReview\` in the frontend's \`lib/mock/adminReviews.ts\`. The only difference: \`status\` is always present (the frontend treats a missing status as \`published\`). \`author\` and \`body\` have \`en\` and \`ar\`; \`at\` is a day (\`YYYY-MM-DD\`, UTC).

A bad filter value, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No matches is \`200\` with \`total: 0\`, not an error.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**قائمة التقييمات** لصفحة الإشراف، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (التقييمات المطابقة للفلاتر) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر في الصفحة، وتُطبَّق معًا:

- \`about\`: \`provider\` أو \`guest\`.
- \`stars\`: من \`1\` إلى \`5\`.
- \`status\`: \`published\` أو \`flagged\` أو \`hidden\`.
- \`search\`: يطابق الجهة المقيَّمة والكاتب ونص التقييم (بالإنجليزية أو العربية) ورمز الحجز، دون تمييز حالة الأحرف.

لكل عنصر نفس شكل \`AdminReview\` في الواجهة الأمامية، والفرق الوحيد أن \`status\` موجود دائمًا.

قيمة فلتر غير صحيحة أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود نتائج يعيد \`200\` مع \`total: 0\` وليس خطأ.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const STATUS_DESCRIPTION = `
**Moderates one review:** publish it, flag it or hide it. This is the action behind the row menu of the reviews page. Returns the updated review (same shape as an item of \`GET /admin/reviews\`).

- Body: \`{ "status": "published" | "flagged" | "hidden" }\`. Nothing else is allowed in the body.
- Setting the status a review already has succeeds and changes nothing, so a repeated click is safe.
- A malformed \`id\`, a missing or unknown \`status\` or extra fields give \`400 VALIDATION_FAILED\` with one translated message per field. An id that doesn't exist gives \`404 REVIEW_NOT_FOUND\`.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**إشراف على تقييم واحد:** نشره أو الإبلاغ عنه أو إخفاؤه. هذا هو الإجراء وراء قائمة الصف في صفحة التقييمات. يعيد التقييم بعد التحديث (بنفس شكل عنصر \`GET /admin/reviews\`).

- المحتوى: \`{ "status": "published" | "flagged" | "hidden" }\` ولا يُسمح بغير ذلك.
- تعيين الحالة الحالية نفسها ينجح دون أي تغيير، فالنقر المتكرر آمن.
- \`id\` غير صالح أو \`status\` مفقودة أو غير معروفة أو حقول إضافية تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. معرّف غير موجود يعيد \`404 REVIEW_NOT_FOUND\`.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const ListAdminReviewsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List reviews (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminReviewPageDto,
      description: 'One page of reviews; `items` is `[]` past the last page.',
    }),
  );

export const SetReviewStatusDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Publish, flag or hide a review', description: STATUS_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam({ name: 'id', format: 'uuid', description: 'Review id from `GET /admin/reviews`.' }),
    ApiOkResponse({ type: AdminReviewDto, description: 'The review with its new status.' }),
    ApiNotFoundResponse({
      type: ErrorResponseDto,
      description: '`REVIEW_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`',
    }),
  );
