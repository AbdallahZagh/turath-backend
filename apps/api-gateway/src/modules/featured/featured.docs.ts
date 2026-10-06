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
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import {
  AdminPromotionDto,
  AdminPromotionPageDto,
  FeaturedSlotsOverviewDto,
  LiveFeaturedDto,
  PromotionTargetDto,
  SaveFeaturedSlotsDto,
  SavePromotionDto,
} from './dto/featured.dto.js';

/** Swagger docs for the Featured API (home page promotions). */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_NOTE_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_NOTE_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const SLOTS = `\`heritage_spotlight\` (6 at a time), \`pillar_hotels\`, \`pillar_dining\`, \`pillar_trips\`, \`pillar_events\`, \`pillar_guides\` (1 each), \`home_campaign\` (1, the only one that takes a \`campaign\`) and \`persona_rail\` (4)`;
const SLOTS_AR = `\`heritage_spotlight\` (6 في الوقت نفسه) و\`pillar_hotels\` و\`pillar_dining\` و\`pillar_trips\` و\`pillar_events\` و\`pillar_guides\` (واحد لكل منها) و\`home_campaign\` (واحد، وهي الوحيدة التي تقبل \`campaign\`) و\`persona_rail\` (4)`;

const RULES = `A promotion can be saved only if: its \`kind\` suits the slot (\`campaign\` for \`home_campaign\`, \`featured\` for every other slot, otherwise \`400 PROMOTION_KIND_SLOT_MISMATCH\`); featuring and that slot are switched on (\`GET /admin/featured/slots\`, otherwise \`409 FEATURED_SLOT_DISABLED\`); and the slot has a free place (\`409 FEATURED_SLOT_AT_CAPACITY\`). Scheduled and live promotions each take a place, whatever their dates; ended ones don't, so a promotion that has already ended is only checked for its kind. Two admins filling the last place at once cannot both succeed.`;
const RULES_AR = `لا يُحفظ العرض إلا إذا: كان \`kind\` مناسبًا للخانة (\`campaign\` لـ \`home_campaign\` و\`featured\` لبقية الخانات، وإلا \`400 PROMOTION_KIND_SLOT_MISMATCH\`)؛ وكان الإبراز وتلك الخانة مفعّلَين (\`GET /admin/featured/slots\`، وإلا \`409 FEATURED_SLOT_DISABLED\`)؛ وكان في الخانة مكان فارغ (\`409 FEATURED_SLOT_AT_CAPACITY\`). العروض المجدولة والمباشرة يشغل كل منها مكانًا مهما كانت تواريخها، أما المنتهية فلا، لذلك يُفحص العرض المنتهي أصلًا من حيث النوع فقط. ولا يمكن لمشرفين ملء المكان الأخير في الوقت نفسه.`;

const LINK = `**Link (optional).** \`link: { "type": "category" | "heritageSite" | "provider", "id": "..." }\` makes the promotion open something real instead of being only text. Pick the target with \`GET /admin/featured/targets\` and send its \`type\` and \`id\` (for a category, \`id\` is \`hotels\`, \`dining\`, \`trips\`, \`events\` or \`guides\`). It must exist (\`400 PROMOTION_LINK_NOT_FOUND\`) and be a published heritage site or an approved business (\`409 PROMOTION_LINK_UNAVAILABLE\`); a promotion that already links to something can still be edited if that thing is later unpublished. Left out or \`null\`: no link. Saving replaces the link, so send it again to keep it. The \`target\` text is still required and is what is shown. If the business or site is deleted the promotion stays and the link becomes \`null\`.`;
const LINK_AR = `**الربط (اختياري).** \`link: { "type": "category" | "heritageSite" | "provider", "id": "..." }\` يجعل العرض يفتح شيئًا حقيقيًا بدل أن يكون نصًا فقط. اختر الهدف عبر \`GET /admin/featured/targets\` وأرسل \`type\` و\`id\` الخاصين به (للتصنيف تكون \`id\` إحدى القيم \`hotels\` أو \`dining\` أو \`trips\` أو \`events\` أو \`guides\`). يجب أن يكون موجودًا (\`400 PROMOTION_LINK_NOT_FOUND\`) وأن يكون موقعًا تراثيًا منشورًا أو منشأة معتمدة (\`409 PROMOTION_LINK_UNAVAILABLE\`)؛ والعرض المرتبط أصلًا بشيء يمكن تعديله حتى لو أُلغي نشر ذلك الشيء لاحقًا. غير مُرسل أو \`null\`: دون ربط. الحفظ يستبدل الرابط، فأرسله مجددًا للإبقاء عليه. نص \`target\` يبقى مطلوبًا وهو ما يُعرض. إذا حُذفت المنشأة أو الموقع يبقى العرض ويصبح الرابط \`null\`.`;

const TARGETS_DESCRIPTION = `
**What a promotion can be linked to**, for the search box of the add / edit form (it replaces the fixed list of presets). Three kinds, each only when it can really be opened:

- \`category\`: the booking categories (\`hotels\`, \`dining\`, \`trips\`, \`events\`, \`guides\`), named as in the categories list of \`/admin/lists\`.
- \`heritageSite\`: **published** heritage sites. \`slug\` is the page they open; \`detail\` is the governorate.
- \`provider\`: **approved** businesses. \`slug\` is \`null\` (no public page yet); \`detail\` is the category.

Query: \`?type=\` for one kind only (without it, up to \`limit\` of each kind, categories first), \`?search=\` (name in English or Arabic, or slug, ignoring case) and \`?limit=\` (1–50, default 20, per kind). Each item has \`type\`, \`id\`, \`name\`, \`slug\` and \`detail\`; send \`type\` and \`id\` as the \`link\` of \`POST\` / \`PUT /admin/featured\`. Names are sorted A–Z. Not cached, so a business shows up as soon as it is approved.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**ما يمكن ربط العرض به**، لمربع البحث في نموذج الإضافة / التعديل (ويحلّ محل القائمة الثابتة للقيم الجاهزة). ثلاثة أنواع، وكل منها فقط إذا كان يمكن فتحه فعلًا:

- \`category\`: تصنيفات الحجز (\`hotels\` و\`dining\` و\`trips\` و\`events\` و\`guides\`) بأسمائها في قائمة التصنيفات في \`/admin/lists\`.
- \`heritageSite\`: المواقع التراثية **المنشورة**. \`slug\` هو الصفحة التي تُفتح؛ و\`detail\` المحافظة.
- \`provider\`: المنشآت **المعتمدة**. \`slug\` هو \`null\` (لا صفحة عامة بعد)؛ و\`detail\` التصنيف.

المعاملات: \`?type=\` لنوع واحد فقط (دونه حتى \`limit\` من كل نوع، والتصنيفات أولًا) و\`?search=\` (الاسم بالإنجليزية أو العربية أو slug دون تمييز حالة الأحرف) و\`?limit=\` (من 1 إلى 50، الافتراضي 20 لكل نوع). لكل عنصر \`type\` و\`id\` و\`name\` و\`slug\` و\`detail\`؛ أرسل \`type\` و\`id\` كـ \`link\` في \`POST\` / \`PUT /admin/featured\`. الأسماء مرتبة أ–ي. غير مخزَّنة مؤقتًا، فتظهر المنشأة فور اعتمادها.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const LIST_DESCRIPTION = `
**Lists promotions** for the Featured page (\`/admin/featured\`), newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar; they combine:

- \`slot\`: ${SLOTS}.
- \`kind\`: \`featured\` or \`campaign\`.
- \`status\`: \`scheduled\`, \`live\` or \`ended\`, by today's date (UTC).
- \`search\`: matches the title and target (English or Arabic) and the slot id, ignoring case.

Each item has the same shape as \`AdminPromotion\` in the frontend's \`lib/mock/adminPromotions.ts\`, plus \`status\` (the frontend works it out from the dates; here it is ready, and \`?status=\` filters on it) and \`link\` (what it opens, with its name and \`available\`, or \`null\`). Dates are \`YYYY-MM-DD\`, both included.

A bad filter, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. Cached for up to 60 seconds, per day, and dropped as soon as a promotion or a slot switch changes.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**قائمة العروض** لصفحة المميّز (\`/admin/featured\`)، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر، وتُطبَّق معًا:

- \`slot\`: ${SLOTS_AR}.
- \`kind\`: \`featured\` أو \`campaign\`.
- \`status\`: \`scheduled\` أو \`live\` أو \`ended\` بحسب تاريخ اليوم (UTC).
- \`search\`: يطابق العنوان والهدف (بالإنجليزية أو العربية) ومعرّف الخانة، دون تمييز حالة الأحرف.

لكل عنصر نفس شكل \`AdminPromotion\` في الواجهة الأمامية، مع \`status\` (تحسبها الواجهة من التواريخ؛ وهي هنا جاهزة ويمكن الفلترة بها). التواريخ بصيغة \`YYYY-MM-DD\` ويدخل اليومان معًا.

فلتر غير صحيح أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. تُخزَّن حتى 60 ثانية، ليومٍ واحد، وتُمسح فور تغيّر أي عرض أو مفتاح خانة.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const GET_DESCRIPTION = `
**One promotion**: same shape as an item of \`GET /admin/featured\`. A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 PROMOTION_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**عرض واحد**: بنفس شكل عنصر \`GET /admin/featured\`. \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 PROMOTION_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const CREATE_DESCRIPTION = `
**Adds a promotion** (the "add" action of the page). Same body as \`SaveAdminPromotionInput\` in the frontend mock. Returns the new promotion (\`201\`).

- \`title\` and \`target\`: \`{ en, ar }\`, both required, trimmed, 1–150 characters.
- \`slot\`: ${SLOTS}. \`kind\`: \`featured\` or \`campaign\`.
- \`startAt\` and \`endAt\`: real days, \`YYYY-MM-DD\`; \`endAt\` is the same day as \`startAt\` or later.

${RULES}

${LINK}

A missing or invalid field or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`title.en\`).

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**إضافة عرض** (إجراء "إضافة" في الصفحة). نفس محتوى \`SaveAdminPromotionInput\` في الواجهة الأمامية. يعيد العرض الجديد (\`201\`).

- \`title\` و\`target\`: \`{ en, ar }\` والاثنان مطلوبان، من 1 إلى 150 حرفًا مع إزالة الفراغات الزائدة.
- \`slot\`: ${SLOTS_AR}. و\`kind\`: \`featured\` أو \`campaign\`.
- \`startAt\` و\`endAt\`: يومان حقيقيان بصيغة \`YYYY-MM-DD\`؛ و\`endAt\` هو يوم \`startAt\` نفسه أو بعده.

${RULES_AR}

${LINK_AR}

حقل مفقود أو غير صالح أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`title.en\`).

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const UPDATE_DESCRIPTION = `
**Saves a promotion** (the "edit" action): every field is replaced, so send the whole promotion. Same body and rules as when adding; its own place in a slot doesn't count against the slot's capacity, so it can be saved again unchanged. Returns the promotion.

${RULES}

${LINK}

An unknown id gives \`404 PROMOTION_NOT_FOUND\`; a malformed \`id\` or an invalid body gives \`400 VALIDATION_FAILED\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حفظ عرض** (إجراء "تعديل"): تُستبدل كل الحقول، فأرسل العرض كاملًا. نفس المحتوى والقواعد كما عند الإضافة؛ ومكان العرض نفسه في الخانة لا يُحسب على سعتها، فيمكن حفظه مجددًا دون تغيير. يعيد العرض.

${RULES_AR}

${LINK_AR}

معرّف غير موجود يعيد \`404 PROMOTION_NOT_FOUND\`؛ و\`id\` غير صالح أو محتوى غير صالح يعيد \`400 VALIDATION_FAILED\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const DELETE_DESCRIPTION = `
**Deletes a promotion** (the "delete" action). Returns \`204\` with no body, and frees its place in the slot. A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist (also one already deleted) gives \`404 PROMOTION_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حذف عرض** (إجراء "حذف"). يعيد \`204\` دون محتوى ويُخلي مكانه في الخانة. \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود (أو محذوف سابقًا) يعيد \`404 PROMOTION_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const SLOTS_DESCRIPTION = `
**The home page slots**: the master switch \`featuringEnabled\` and each of the eight slots (${SLOTS}) with:

- \`capacity\`: how many promotions it holds at once, and \`occupied\`: how many it holds now (scheduled and live).
- \`enabled\`: its own switch, and \`active\`: \`featuringEnabled\` and \`enabled\` together. Only an active slot takes promotions and shows on the home page.
- \`requiresCampaign\`: \`true\` for \`home_campaign\`, the only slot that takes a \`campaign\`.

Everything is on until someone saves. The switches are the same ones as \`featuringEnabled\` and \`featuredSlots\` in the frontend's admin settings. Cached for up to 60 seconds.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**خانات الصفحة الرئيسية**: المفتاح العام \`featuringEnabled\` وكل خانة من الخانات الثماني (${SLOTS_AR}) مع:

- \`capacity\`: عدد العروض التي تتّسع لها في الوقت نفسه، و\`occupied\`: عدد ما فيها الآن (المجدولة والمباشرة).
- \`enabled\`: مفتاحها الخاص، و\`active\`: \`featuringEnabled\` و\`enabled\` معًا. الخانة الفعّالة وحدها تقبل عروضًا وتظهر في الصفحة الرئيسية.
- \`requiresCampaign\`: \`true\` لـ \`home_campaign\`، الخانة الوحيدة التي تقبل \`campaign\`.

كل شيء مفعّل إلى أن يحفظ أحدهم. المفاتيح هي نفسها \`featuringEnabled\` و\`featuredSlots\` في إعدادات الإدارة بالواجهة الأمامية. تُخزَّن حتى 60 ثانية.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const SAVE_SLOTS_DESCRIPTION = `
**Saves the switches** of the home page slots: \`featuringEnabled\` and all eight slots, together, all or nothing. Returns the slots as \`GET /admin/featured/slots\` does.

- Body: \`{ "featuringEnabled": true, "slots": { "heritage_spotlight": true, "pillar_hotels": true, … } }\`. Send every switch; nothing else is allowed.
- Promotions already in a slot that is switched off stay, but stop showing on the home page, and nothing new can be added to that slot (\`409 FEATURED_SLOT_DISABLED\`) until it is switched on again.

A missing or non-boolean switch or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`slots.pillar_hotels\`).

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حفظ مفاتيح** خانات الصفحة الرئيسية: \`featuringEnabled\` والخانات الثماني معًا، إما كلها أو لا شيء. يعيد الخانات بنفس شكل \`GET /admin/featured/slots\`.

- المحتوى: \`{ "featuringEnabled": true, "slots": { "heritage_spotlight": true, "pillar_hotels": true, … } }\`. أرسل كل المفاتيح ولا يُسمح بغيرها.
- العروض الموجودة في خانة أُوقفت تبقى لكنها تتوقف عن الظهور في الصفحة الرئيسية، ولا يمكن إضافة جديد إلى تلك الخانة (\`409 FEATURED_SLOT_DISABLED\`) إلى أن تُفعَّل مجددًا.

مفتاح مفقود أو غير منطقي أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`slots.pillar_hotels\`).

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const LIVE_DESCRIPTION = `
**What the home page shows right now**: for each of the eight slots, the promotions running today (from \`startAt\` to \`endAt\`, both included), newest first. A slot that is switched off, or when featuring is switched off, is \`[]\`. Each promotion has its \`link\` (a category, a heritage site with its \`slug\`, or a business); one whose business is no longer approved or whose site is no longer published is left out. Every key is always present. No sign-in and no key.

Cached for 30 seconds on the server, and the response allows browsers and CDNs to keep it for 30 seconds too (\`Cache-Control: public, max-age=30\`), so a change in the admin page reaches the home page within about a minute.
${rtl(`
**ما تعرضه الصفحة الرئيسية الآن**: لكل خانة من الخانات الثماني، العروض الجارية اليوم (من \`startAt\` إلى \`endAt\` ويدخل اليومان)، الأحدث أولًا. الخانة المتوقفة، أو عند إيقاف الإبراز كله، تكون \`[]\`. كل المفاتيح موجودة دائمًا. دون تسجيل دخول ودون مفتاح.

تُخزَّن 30 ثانية على الخادم، وتسمح الاستجابة للمتصفحات وشبكات التوزيع بحفظها 30 ثانية أيضًا (\`Cache-Control: public, max-age=30\`)، فيصل التغيير من صفحة الإدارة إلى الصفحة الرئيسية خلال دقيقة تقريبًا.
`)}`;

const NOT_FOUND = '`PROMOTION_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Promotion id from `GET /admin/featured`.' };
const SAVE_CONFLICT =
  '`FEATURED_SLOT_DISABLED` (the slot or featuring is off), `FEATURED_SLOT_AT_CAPACITY` (the slot is full) or `PROMOTION_LINK_UNAVAILABLE` (the business is not approved or the site not published)';

export const ListPromotionsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List promotions (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminPromotionPageDto,
      description: 'One page of promotions; `items` is `[]` past the last page.',
    }),
  );

export const GetPromotionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One promotion', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminPromotionDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const CreatePromotionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add a promotion', description: CREATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: SavePromotionDto }),
    ApiCreatedResponse({ type: AdminPromotionDto, description: 'The new promotion.' }),
    ApiConflictResponse({ type: ErrorResponseDto, description: SAVE_CONFLICT }),
  );

export const UpdatePromotionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save a promotion', description: UPDATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiBody({ type: SavePromotionDto }),
    ApiOkResponse({ type: AdminPromotionDto, description: 'The promotion as saved.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
    ApiConflictResponse({ type: ErrorResponseDto, description: SAVE_CONFLICT }),
  );

export const DeletePromotionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a promotion', description: DELETE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiNoContentResponse({ description: 'Deleted.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const ListTargetsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'What a promotion can link to (search)', description: TARGETS_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: [PromotionTargetDto],
      description: 'Categories first, then heritage sites, then businesses.',
    }),
  );

export const GetSlotsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Home page slots and their switches', description: SLOTS_DESCRIPTION }),
    ApiOkResponse({ type: FeaturedSlotsOverviewDto }),
  );

export const SaveSlotsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save the slot switches', description: SAVE_SLOTS_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: SaveFeaturedSlotsDto }),
    ApiOkResponse({ type: FeaturedSlotsOverviewDto, description: 'The slots as now saved.' }),
  );

export const LiveFeaturedDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Live promotions for the home page', description: LIVE_DESCRIPTION }),
    ApiOkResponse({ type: LiveFeaturedDto }),
  );
