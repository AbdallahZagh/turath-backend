import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { COUPON_MAX_COUNT, COUPON_MAX_FIXED_DISCOUNT_SYP } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminCouponDto, AdminCouponPageDto, CouponTargetDto, SaveCouponDto } from './dto/admin-coupon.dto.js';

/** Swagger docs for the admin discount codes API. */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_NOTE_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_NOTE_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const RULES = `**Fields.** \`title\`: \`{ en, ar }\`, both required, 1–150 characters. \`code\`: spaces are dropped and letters upper-cased, then it must be 3–16 letters or digits, and unique (\`409 COUPON_CODE_TAKEN\`). \`discountKind\` \`percent\` takes a whole number 1–100 as \`discountValue\`; \`fixed\` takes whole Syrian pounds from 1 up to ${COUPON_MAX_FIXED_DISCOUNT_SYP.toLocaleString('en-US')}. \`startAt\` / \`endAt\`: real days \`YYYY-MM-DD\`, \`endAt\` the same day or later. \`maxRedemptions\` (total) and \`perGuestCap\` (per guest): a whole number from 1 up to ${COUPON_MAX_COUNT.toLocaleString('en-US')}, or \`null\` / left out for no limit. \`enabled\`: required.

**Scope.** \`platform\`: everything, \`scopeId\` must be \`null\`. \`pillar\`: one booking category, \`scopeId\` is \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`. \`provider\`: one business, \`scopeId\` is its id (\`GET /admin/discount-codes/targets?scope=provider\`; \`400 COUPON_PROVIDER_NOT_FOUND\` if it doesn't exist). \`listing\`: one listing, \`scopeId\` is the listing id (letters, digits and \`- _ . :\`, up to 100; listings are not checked against anything yet). A scope that doesn't fit its \`scopeId\` gives \`400 COUPON_SCOPE_INVALID\`.`;
const RULES_AR = `**الحقول.** \`title\`: \`{ en, ar }\` والاثنان مطلوبان، من 1 إلى 150 حرفًا. \`code\`: تُحذف المسافات وتتحول الأحرف إلى كبيرة، ثم يجب أن يكون من 3 إلى 16 حرفًا أو رقمًا وفريدًا (\`409 COUPON_CODE_TAKEN\`). \`discountKind\` بقيمة \`percent\` يأخذ \`discountValue\` عددًا صحيحًا من 1 إلى 100؛ و\`fixed\` يأخذ ليرات سورية صحيحة من 1 حتى ${COUPON_MAX_FIXED_DISCOUNT_SYP.toLocaleString('en-US')}. \`startAt\` / \`endAt\`: يومان حقيقيان \`YYYY-MM-DD\` و\`endAt\` اليوم نفسه أو بعده. \`maxRedemptions\` (الإجمالي) و\`perGuestCap\` (لكل ضيف): عدد صحيح من 1 حتى ${COUPON_MAX_COUNT.toLocaleString('en-US')}، أو \`null\` / غير مُرسل لعدم وجود حد. \`enabled\`: مطلوب.

**النطاق.** \`platform\`: كل شيء، و\`scopeId\` يجب أن يكون \`null\`. \`pillar\`: تصنيف حجز واحد، و\`scopeId\` هو \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`. \`provider\`: منشأة واحدة، و\`scopeId\` هو معرّفها (\`GET /admin/discount-codes/targets?scope=provider\`؛ و\`400 COUPON_PROVIDER_NOT_FOUND\` إن لم توجد). \`listing\`: عرض واحد، و\`scopeId\` هو معرّفه (أحرف وأرقام و\`- _ . :\` حتى 100؛ ولا يُتحقق من العروض مقابل شيء بعد). نطاق لا يناسب \`scopeId\` يعيد \`400 COUPON_SCOPE_INVALID\`.`;

const LIST_DESCRIPTION = `
**Lists discount codes** for the table of the discount codes page (\`/admin/discount-codes\`), newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

**Filters** (all optional; they combine, and \`total\` counts only the matches):

- \`scope\`: \`platform\`, \`pillar\`, \`provider\` or \`listing\`.
- \`status\`, by today's date (UTC): \`disabled\` (switched off), \`scheduled\` (on, starts later), \`live\` (on, today is from \`startAt\` to \`endAt\`) or \`ended\` (on, \`endAt\` has passed).
- \`discountKind\`: \`percent\` or \`fixed\`.

**Search** \`?search=\` (ignores case) matches the title in English or Arabic, the code, the listing id, and the name — in either language — of the category or business the code is scoped to. So typing a business name finds the codes for that business, and "dining" or "الطعام" finds the dining category codes. Empty means no search.

Each item has the same shape as \`AdminCoupon\` in the frontend's \`lib/mock/adminCoupons.ts\`, plus \`status\`, \`scopeName\` (the name of the category or business; \`null\` for platform and listing codes), \`redemptions\` (bookings that used the code, cancelled ones not counted) and the timestamps.

A bad filter, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. Cached for up to 60 seconds, per day, and dropped as soon as a code or a booking's status changes.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**قائمة رموز الخصم** لجدول صفحة رموز الخصم (\`/admin/discount-codes\`)، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

**الفلاتر** (كلها اختيارية وتُطبَّق معًا، و\`total\` يعدّ المطابق فقط):

- \`scope\`: \`platform\` أو \`pillar\` أو \`provider\` أو \`listing\`.
- \`status\` بحسب تاريخ اليوم (UTC): \`disabled\` (متوقف)، \`scheduled\` (مفعّل ويبدأ لاحقًا)، \`live\` (مفعّل واليوم بين \`startAt\` و\`endAt\`) أو \`ended\` (مفعّل وانتهى \`endAt\`).
- \`discountKind\`: \`percent\` أو \`fixed\`.

**البحث** \`?search=\` (دون تمييز حالة الأحرف) يطابق العنوان بالإنجليزية أو العربية، والرمز، ومعرّف العرض، واسم التصنيف أو المنشأة التي يخصها الرمز بأي من اللغتين. فكتابة اسم منشأة تجد رموزها، وكتابة "dining" أو "الطعام" تجد رموز تصنيف الطعام. الفارغ يعني دون بحث.

لكل عنصر نفس شكل \`AdminCoupon\` في الواجهة الأمامية، مع \`status\` و\`scopeName\` (اسم التصنيف أو المنشأة؛ \`null\` لرموز المنصة والعروض) و\`redemptions\` (الحجوزات التي استخدمت الرمز، دون الملغاة) والطوابع الزمنية.

فلتر غير صحيح أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. تُخزَّن حتى 60 ثانية، ليومٍ واحد، وتُمسح فور تغيّر أي رمز أو حالة أي حجز.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const GET_DESCRIPTION = `
**One discount code**: same shape as an item of \`GET /admin/discount-codes\`. A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 COUPON_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**رمز خصم واحد**: بنفس شكل عنصر \`GET /admin/discount-codes\`. \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 COUPON_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const CREATE_DESCRIPTION = `
**Adds a discount code** (the "add" action of the page). Same body as \`SaveAdminCouponInput\` in the frontend mock. Returns the new code (\`201\`).

${RULES}

A missing or invalid field or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`title.en\`).

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**إضافة رمز خصم** (إجراء "إضافة" في الصفحة). نفس محتوى \`SaveAdminCouponInput\` في الواجهة الأمامية. يعيد الرمز الجديد (\`201\`).

${RULES_AR}

حقل مفقود أو غير صالح أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`title.en\`).

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const UPDATE_DESCRIPTION = `
**Saves a discount code** (the "edit" action): every field is replaced, so send the whole code (a limit left out means no limit). Same body and rules as when adding. Returns the code.

**Once a code has been used in bookings its code text can't change** (\`409 COUPON_CODE_LOCKED\`): those bookings are tied to it by that text, and the limits would start from zero. Switch it off (\`enabled: false\`) and add a new code instead. Everything else can still be edited.

${RULES}

An unknown id gives \`404 COUPON_NOT_FOUND\`; a malformed \`id\` or an invalid body gives \`400 VALIDATION_FAILED\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حفظ رمز خصم** (إجراء "تعديل"): تُستبدل كل الحقول، فأرسل الرمز كاملًا (والحد غير المُرسل يعني دون حد). نفس المحتوى والقواعد كما عند الإضافة. يعيد الرمز.

**بعد أن يُستخدم الرمز في حجوزات لا يمكن تغيير نصه** (\`409 COUPON_CODE_LOCKED\`): فتلك الحجوزات مرتبطة به بهذا النص، وستبدأ الحدود من الصفر. أوقفه (\`enabled: false\`) وأضف رمزًا جديدًا بدلًا منه. وكل ما عدا ذلك يمكن تعديله.

${RULES_AR}

معرّف غير موجود يعيد \`404 COUPON_NOT_FOUND\`؛ و\`id\` غير صالح أو محتوى غير صالح يعيد \`400 VALIDATION_FAILED\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const DELETE_DESCRIPTION = `
**Deletes a discount code** (the "delete" action). Returns \`204\` with no body. Bookings that used it keep the code text, so to stop a code that was used, switch it off instead of deleting it (adding the same code again later would count those old bookings against its limits). A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist (also one already deleted) gives \`404 COUPON_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حذف رمز خصم** (إجراء "حذف"). يعيد \`204\` دون محتوى. الحجوزات التي استخدمته تحتفظ بنص الرمز، لذلك لإيقاف رمز استُخدم أوقفه بدل حذفه (فإضافة الرمز نفسه لاحقًا ستحسب تلك الحجوزات القديمة على حدوده). \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود (أو محذوف سابقًا) يعيد \`404 COUPON_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const TARGETS_DESCRIPTION = `
**What a code can be scoped to**, for the scope dropdown of the add / edit form. \`?scope=\` is required:

- \`pillar\`: the five booking categories (\`hotels\`, \`dining\`, \`trips\`, \`events\`, \`guides\`), named as in the categories list of \`/admin/lists\`.
- \`provider\`: **approved** businesses, A–Z; \`detail\` is the business category.

\`?search=\` matches the name in English or Arabic, ignoring case; \`?limit=\` is 1–50 (default 20). Each item has \`scope\`, \`id\`, \`name\` and \`detail\`; send \`id\` as \`scopeId\`. Not cached, so a business shows up as soon as it is approved. There is no list for the \`listing\` scope yet: a listing id is typed in.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**ما يمكن أن يُحدَّد نطاقًا لرمز**، لقائمة النطاق في نموذج الإضافة / التعديل. \`?scope=\` مطلوب:

- \`pillar\`: تصنيفات الحجز الخمسة (\`hotels\` و\`dining\` و\`trips\` و\`events\` و\`guides\`) بأسمائها في قائمة التصنيفات في \`/admin/lists\`.
- \`provider\`: المنشآت **المعتمدة** مرتبة أ–ي؛ و\`detail\` هو تصنيف المنشأة.

\`?search=\` يطابق الاسم بالإنجليزية أو العربية دون تمييز حالة الأحرف؛ و\`?limit=\` من 1 إلى 50 (الافتراضي 20). لكل عنصر \`scope\` و\`id\` و\`name\` و\`detail\`؛ أرسل \`id\` كـ \`scopeId\`. غير مخزَّنة مؤقتًا، فتظهر المنشأة فور اعتمادها. لا توجد قائمة لنطاق \`listing\` بعد: يُكتب معرّف العرض يدويًا.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const NOT_FOUND = '`COUPON_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Discount code id from `GET /admin/discount-codes`.' };

export const ListCouponsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List discount codes (paged, filterable, searchable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: AdminCouponPageDto, description: 'One page of codes; `items` is `[]` past the last page.' }),
  );

export const GetCouponDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One discount code', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminCouponDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const CreateCouponDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add a discount code', description: CREATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: SaveCouponDto }),
    ApiCreatedResponse({ type: AdminCouponDto, description: 'The new code.' }),
    ApiConflictResponse({ type: ErrorResponseDto, description: '`COUPON_CODE_TAKEN` (that code is already used)' }),
  );

export const UpdateCouponDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save a discount code', description: UPDATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiBody({ type: SaveCouponDto }),
    ApiOkResponse({ type: AdminCouponDto, description: 'The code as saved.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
    ApiConflictResponse({
      type: ErrorResponseDto,
      description:
        '`COUPON_CODE_TAKEN` (another code uses it) or `COUPON_CODE_LOCKED` (it was already used in bookings)',
    }),
  );

export const DeleteCouponDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a discount code', description: DELETE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiNoContentResponse({ description: 'Deleted.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const ListCouponTargetsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'What a code can be scoped to (search)', description: TARGETS_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: [CouponTargetDto] }),
  );
