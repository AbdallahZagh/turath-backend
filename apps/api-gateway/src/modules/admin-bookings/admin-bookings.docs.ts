import { applyDecorators } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminBookingDetailDto, AdminBookingPageDto } from './dto/admin-booking.dto.js';

/** Swagger docs for the admin bookings API. */

const LIST_DESCRIPTION = `
**Lists bookings** for the bookings table, newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` (bookings matching the filters) and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar of the page; they combine (all must match):

- \`category\`: \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`.
- \`status\`: \`pending\`, \`confirmed\`, \`checkedIn\`, \`completed\`, \`cancelled\`, \`noShow\` or \`disputed\`.
- \`search\`: matches the guest and provider names (English or Arabic), the guest phone and the booking code, ignoring case. A phone can be typed with spaces, dashes or a leading \`+\`.

Each item has the same shape as \`AdminBooking\` in the frontend's \`lib/mock/adminBookings.ts\`: \`when.end\` is only there for stays, \`when.time\` (\`HH:mm\`, 24h) for dining, events and guides, and \`couponCode\`, \`discountSyp\` and \`originalAmountSyp\` only when a coupon was used. Amounts are whole Syrian pounds.

A bad filter value, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. No matches is \`200\` with \`total: 0\`, not an error.

**Caching:** pages are cached for up to 60 seconds and dropped as soon as any booking changes, so a status change shows up on the next request.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**قائمة الحجوزات** لجدول الحجوزات، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` (الحجوزات المطابقة للفلاتر) و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر في الصفحة، وتُطبَّق معًا:

- \`category\`: \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`.
- \`status\`: \`pending\` أو \`confirmed\` أو \`checkedIn\` أو \`completed\` أو \`cancelled\` أو \`noShow\` أو \`disputed\`.
- \`search\`: يطابق اسمَي الضيف والمزوّد (بالإنجليزية أو العربية) وهاتف الضيف ورمز الحجز، دون تمييز حالة الأحرف. يمكن كتابة الهاتف بمسافات أو شرطات أو \`+\` في البداية.

لكل عنصر نفس شكل \`AdminBooking\` في الواجهة الأمامية: \`when.end\` للإقامات فقط، و\`when.time\` (\`HH:mm\` بنظام 24 ساعة) للمطاعم والفعاليات والمرشدين، و\`couponCode\` و\`discountSyp\` و\`originalAmountSyp\` عند استخدام قسيمة فقط. المبالغ بالليرة السورية كأعداد صحيحة.

قيمة فلتر غير صحيحة أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. عدم وجود نتائج يعيد \`200\` مع \`total: 0\` وليس خطأ.

**التخزين المؤقت:** تُخزَّن الصفحات حتى 60 ثانية وتُمسح فور تغيّر أي حجز، فيظهر تغيير الحالة في الطلب التالي.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const GET_DESCRIPTION = `
**One booking** for the details drawer that opens from a row of the bookings table: everything in the row (same shape as an item of \`GET /admin/bookings\`) plus:

- \`guestId\`: the guest's account, to link to \`GET /admin/users/{id}\`. \`null\` when the booking isn't linked to an account.
- \`providerId\`: the provider's account. \`null\` until providers exist as accounts.
- \`createdAt\` / \`updatedAt\`: ISO 8601 timestamps.

A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 BOOKING_NOT_FOUND\`. The result is cached for up to 60 seconds and dropped as soon as any booking changes.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**حجز واحد** للدرج الذي يُفتح من صف في جدول الحجوزات: كل ما في الصف (بنفس شكل عنصر \`GET /admin/bookings\`) بالإضافة إلى:

- \`guestId\`: حساب الضيف، للربط مع \`GET /admin/users/{id}\`. \`null\` إذا لم يكن الحجز مرتبطًا بحساب.
- \`providerId\`: حساب المزوّد. \`null\` إلى أن تصبح المزوّدات حسابات.
- \`createdAt\` / \`updatedAt\`: طوابع زمنية بصيغة ISO 8601.

\`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 BOOKING_NOT_FOUND\`. تُخزَّن النتيجة حتى 60 ثانية وتُمسح فور تغيّر أي حجز.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const STATUS_DESCRIPTION = `
**Moves a booking to a new status:** the actions of the drawer (check in, no-show, cancel, complete, dispute, reopen). Returns the booking as \`GET /admin/bookings/{id}\` does.

- Body: \`{ "status": "pending" | "confirmed" | "checkedIn" | "completed" | "cancelled" | "noShow" | "disputed" }\`. Nothing else is allowed in the body.
- Allowed steps: \`pending\` → \`confirmed\`, \`checkedIn\`, \`noShow\`, \`cancelled\`; \`confirmed\` → \`checkedIn\`, \`noShow\`, \`cancelled\`; \`checkedIn\` → \`completed\`, \`disputed\`; \`completed\`, \`cancelled\`, \`noShow\` and \`disputed\` → \`confirmed\` (reopen). Any other step gives \`409 BOOKING_STATUS_INVALID\`.
- Setting the status a booking already has succeeds and changes nothing, so a repeated click is safe.
- If another admin changed the booking between your read and your click, you get \`409 BOOKING_STATUS_CHANGED\`: reload the booking and try again.
- A malformed \`id\`, a missing or unknown \`status\` or extra fields give \`400 VALIDATION_FAILED\` with one translated message per field. An id that doesn't exist gives \`404 BOOKING_NOT_FOUND\`.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**نقل حجز إلى حالة جديدة:** إجراءات الدرج (تسجيل الوصول، لم يحضر، إلغاء، إكمال، نزاع، إعادة فتح). يعيد الحجز بنفس شكل \`GET /admin/bookings/{id}\`.

- المحتوى: \`{ "status": "pending" | "confirmed" | "checkedIn" | "completed" | "cancelled" | "noShow" | "disputed" }\` ولا يُسمح بغير ذلك.
- الانتقالات المسموحة: \`pending\` ← \`confirmed\` و\`checkedIn\` و\`noShow\` و\`cancelled\`؛ \`confirmed\` ← \`checkedIn\` و\`noShow\` و\`cancelled\`؛ \`checkedIn\` ← \`completed\` و\`disputed\`؛ و\`completed\` و\`cancelled\` و\`noShow\` و\`disputed\` ← \`confirmed\` (إعادة فتح). أي انتقال آخر يعيد \`409 BOOKING_STATUS_INVALID\`.
- تعيين الحالة الحالية نفسها ينجح دون أي تغيير، فالنقر المتكرر آمن.
- إذا غيّر مشرف آخر الحجز بين قراءتك ونقرتك تحصل على \`409 BOOKING_STATUS_CHANGED\`: أعد تحميل الحجز وحاول مجددًا.
- \`id\` غير صالح أو \`status\` مفقودة أو غير معروفة أو حقول إضافية تعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. معرّف غير موجود يعيد \`404 BOOKING_NOT_FOUND\`.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const NOT_FOUND = '`BOOKING_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Booking id from `GET /admin/bookings`.' };

export const ListAdminBookingsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List bookings (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminBookingPageDto,
      description: 'One page of bookings; `items` is `[]` past the last page.',
    }),
  );

export const GetAdminBookingDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One booking for the details drawer', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminBookingDetailDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const SetBookingStatusDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Change a booking status', description: STATUS_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminBookingDetailDto, description: 'The booking with its new status.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
    ApiConflictResponse({
      type: ErrorResponseDto,
      description:
        '`BOOKING_STATUS_INVALID` (that step is not allowed) or `BOOKING_STATUS_CHANGED` (another admin changed it first)',
    }),
  );
