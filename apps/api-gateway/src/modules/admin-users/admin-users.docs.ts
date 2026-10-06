import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminUserDetailDto, AdminUserPageDto } from './dto/admin-user.dto.js';

/** Swagger docs for the admin guests API. */

const LIST_DESCRIPTION = `
**Lists guest (tourist) accounts** for the admin dashboard, newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (all guests) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Only guests who finished signup (confirmed their phone or email) are listed. Provider and staff accounts are not. Each item has the same shape as \`AdminUser\` in the frontend's \`lib/mock/adminUsers.ts\`:

- \`name\` has \`en\` and \`ar\`. Both hold the name the guest signed up with until accounts store one per language.
- \`phone\` is in international format with spaces (\`+963 933 441 208\`).
- \`email\` is \`null\` for guests who signed up with a phone number only.
- \`reliability\` is an integer from 0 to 100.
- \`completedBookings\` is how many of the guest's bookings are completed.
- \`joinedAt\` and each \`accountEvents[].at\` are days (\`YYYY-MM-DD\`, UTC). A locked account has one \`locked\` event; an unlocked account has none.

**Search and filters** (all optional, they combine): \`search\` matches the guest's name, email or phone number (a phone can be typed with spaces or \`+\`), \`account\` is \`active\` or \`locked\`, and \`reliability\` is \`vip\`, \`standard\`, \`restricted\` or \`suspended\` (the score cut-offs between the tiers are the ones on the settings page). \`total\` counts the guests that match.

A bad \`page\` or \`limit\` (not a whole number, out of range), a bad filter or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No guests at all is \`200\` with \`total: 0\`, not an error.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text. \`404 NOT_FOUND\` (missing or wrong key), \`429 TOO_MANY_REQUESTS\` (30 requests a minute; the message says how long to wait), \`503 SERVICE_UNAVAILABLE\` (the identity service is down or slow, retry shortly), \`500 INTERNAL_ERROR\`.
${rtl(`
**قائمة بحسابات الضيوف (السياح)** للوحة الإدارة، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (كل الضيوف) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

تُعرض فقط الحسابات التي أكملت التسجيل (أكّدت هاتفها أو بريدها)، ولا تُعرض حسابات مزوّدي الخدمة أو الموظفين. لكل عنصر نفس شكل \`AdminUser\` في الواجهة الأمامية:

- \`name\` يحتوي \`en\` و\`ar\`، وكلاهما يحمل الاسم المسجَّل به الضيف إلى أن يصبح للحساب اسم بكل لغة.
- \`phone\` بالصيغة الدولية مع مسافات.
- \`email\` يكون \`null\` لمن سجّل برقم الهاتف فقط.
- \`reliability\` عدد صحيح من 0 إلى 100.
- \`completedBookings\` عدد حجوزات الضيف المكتملة.
- \`joinedAt\` و\`accountEvents[].at\` أيام بصيغة \`YYYY-MM-DD\`. الحساب المقفل له حدث \`locked\` واحد، وغير المقفل بلا أحداث.

**البحث والفلاتر** (اختيارية وتُطبَّق معًا): \`search\` يطابق اسم الضيف أو بريده أو رقم هاتفه (يمكن كتابة الهاتف بمسافات أو \`+\`)، و\`account\` هو \`active\` أو \`locked\`، و\`reliability\` هو \`vip\` أو \`standard\` أو \`restricted\` أو \`suspended\` (حدود الدرجات بين الفئات هي المضبوطة في صفحة الإعدادات). و\`total\` يعدّ الضيوف المطابقين.

قيمة \`page\` أو \`limit\` غير صحيحة (ليست عددًا صحيحًا أو خارج النطاق) أو فلتر غير صحيح أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود ضيوف يعيد \`200\` مع \`total: 0\` وليس خطأ.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const GET_DESCRIPTION = `
**One guest with everything the detail page shows:** \`user\`, \`bookings\`, \`activity\` and \`reviews\` (same shape as \`AdminUserDetailData\` in the frontend).

- \`user\` is the same object as an item of \`GET /admin/users\`.
- \`bookings\` are the guest's bookings (same shape as \`GET /admin/bookings\`), latest visit first.
- \`reviews\` are the reviews about this guest, newest first (same shape as \`GET /admin/reviews\`), whatever their moderation status.
- \`activity\` is the timeline, newest first. The story of each booking plus the account's lock / unlock events.

Errors: a malformed \`id\` gives \`400 VALIDATION_FAILED\` (message on the \`id\` field). An id that doesn't belong to a listed guest (unknown, unverified, provider or staff account) gives \`404 USER_NOT_FOUND\`, which the dashboard shows as "not found".

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**ضيف واحد مع كل ما تعرضه صفحة التفاصيل:** \`user\` و\`bookings\` و\`activity\` و\`reviews\` (نفس شكل \`AdminUserDetailData\` في الواجهة الأمامية).

- \`user\` هو نفس عنصر \`GET /admin/users\`.
- \`bookings\` هي حجوزات الضيف (نفس شكل \`GET /admin/bookings\`)، الأحدث زيارةً أولًا.
- \`reviews\` هي التقييمات المكتوبة عن هذا الضيف، الأحدث أولًا، مهما كانت حالة الإشراف عليها.
- \`activity\` هو السجل الزمني، الأحدث أولًا، ويضم قصة كل حجز وأحداث قفل الحساب وفتحه.

المعرّف \`id\` غير الصالح يعيد \`400 VALIDATION_FAILED\`. المعرّف الذي لا يخص ضيفًا معروضًا في القائمة يعيد \`404 USER_NOT_FOUND\`.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const ListAdminUsersDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List guests (paged, searchable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: AdminUserPageDto, description: 'One page of guests; `items` is `[]` past the last page.' }),
  );

export const GetAdminUserDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One guest with bookings, activity and reviews', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam({ name: 'id', format: 'uuid', description: 'Guest id from `GET /admin/users`.' }),
    ApiOkResponse({ type: AdminUserDetailDto }),
    ApiNotFoundResponse({
      type: ErrorResponseDto,
      description: '`USER_NOT_FOUND` (not a listed guest), or `NOT_FOUND` for a missing or wrong `x-api-key`',
    }),
  );
