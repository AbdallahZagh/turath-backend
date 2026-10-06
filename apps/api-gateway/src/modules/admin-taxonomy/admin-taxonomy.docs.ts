import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { TAXONOMY_MAX_TERMS_PER_KIND } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminTaxonomyTermDto, MoveTaxonomyTermDto, SaveTaxonomyTermDto } from './dto/admin-taxonomy.dto.js';

/** Swagger docs for the admin lists API (categories, amenities and regions). */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_NOTE_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_NOTE_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const LIST_DESCRIPTION = `
**The three lists** of the lists page (\`/admin/lists\`): \`categories\`, \`amenities\` and \`governorates\` (regions). Each entry has the same shape as \`AdminTaxonomyTerm\` in the frontend's \`lib/mock/adminTaxonomy.ts\`: \`id\`, \`kind\`, \`slug\`, \`name\` (\`{ en, ar }\`) and \`sortOrder\`.

The response is one array, the lists in the order \`categories\`, \`amenities\`, \`governorates\`, and each list in its \`sortOrder\` (1, 2, 3… with no gaps). Send \`?kind=\` to get only one list. The lists are small (at most ${TAXONOMY_MAX_TERMS_PER_KIND} entries each), so there is no paging.

The first run starts with the lists of the mock: 5 categories, 10 amenities and the 8 regions. Cached for up to 60 seconds and dropped as soon as a list changes. A bad \`kind\` gives \`400 VALIDATION_FAILED\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**القوائم الثلاث** في صفحة القوائم (\`/admin/lists\`): \`categories\` (التصنيفات) و\`amenities\` (المرافق) و\`governorates\` (المناطق). لكل عنصر نفس شكل \`AdminTaxonomyTerm\` في الواجهة الأمامية: \`id\` و\`kind\` و\`slug\` و\`name\` (\`{ en, ar }\`) و\`sortOrder\`.

الاستجابة مصفوفة واحدة: القوائم بالترتيب \`categories\` ثم \`amenities\` ثم \`governorates\`، وكل قائمة بحسب \`sortOrder\` (1 و2 و3… دون فجوات). أرسل \`?kind=\` للحصول على قائمة واحدة فقط. القوائم صغيرة (${TAXONOMY_MAX_TERMS_PER_KIND} عنصرًا كحد أقصى لكل منها) لذا لا يوجد ترقيم صفحات.

تبدأ القوائم بمحتوى النموذج التجريبي: 5 تصنيفات و10 مرافق و8 مناطق. تُخزَّن حتى 60 ثانية وتُمسح فور تغيّر أي قائمة. \`kind\` غير صحيح يعيد \`400 VALIDATION_FAILED\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const CREATE_DESCRIPTION = `
**Adds an entry** at the end of a list (the "add" action). Same body as \`SaveAdminTaxonomyTermInput\` in the frontend mock. Returns the new entry (\`201\`).

- \`kind\`: \`categories\`, \`amenities\` or \`governorates\`.
- \`name\`: \`{ en, ar }\`, both required, trimmed, 1–100 characters.
- \`slug\` (optional): turned into lower-case letters and digits joined by dashes (up to 80). Empty or left out: made from \`name.en\`. A name with no Latin letters or digits gives \`term-<first 8 characters of the id>\`.
- A slug is unique within its list: a second one gives \`409 TAXONOMY_SLUG_TAKEN\`. A list holds at most ${TAXONOMY_MAX_TERMS_PER_KIND} entries (\`409 TAXONOMY_LIMIT_REACHED\`).

A missing or invalid field or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`name.en\`).

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**إضافة عنصر** في آخر القائمة (إجراء "إضافة"). نفس محتوى \`SaveAdminTaxonomyTermInput\` في الواجهة الأمامية. يعيد العنصر الجديد (\`201\`).

- \`kind\`: \`categories\` أو \`amenities\` أو \`governorates\`.
- \`name\`: \`{ en, ar }\` والاثنان مطلوبان، من 1 إلى 100 حرف مع إزالة الفراغات الزائدة.
- \`slug\` (اختياري): يتحول إلى أحرف لاتينية صغيرة وأرقام تفصل بينها شرطات (حتى 80). فارغ أو غير مُرسل: يُصنع من \`name.en\`. اسم لا يحتوي أحرفًا لاتينية ولا أرقامًا يعطي \`term-<أول 8 أحرف من المعرّف>\`.
- المعرّف النصي فريد داخل القائمة: تكراره يعيد \`409 TAXONOMY_SLUG_TAKEN\`. وتتّسع القائمة لـ ${TAXONOMY_MAX_TERMS_PER_KIND} عنصرًا (\`409 TAXONOMY_LIMIT_REACHED\`).

حقل مفقود أو غير صالح أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`name.en\`).

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const UPDATE_DESCRIPTION = `
**Edits an entry** (the "edit" action): its name and slug. Same body as when adding; \`kind\` must be the list the entry is already in, otherwise \`400 TAXONOMY_KIND_MISMATCH\`: an entry never moves to another list. Its position stays. Returns the entry.

The slug follows the same rules as when adding (empty means made from \`name.en\`), and may stay the same. Another entry of the same list using it gives \`409 TAXONOMY_SLUG_TAKEN\`. An unknown id gives \`404 TAXONOMY_TERM_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**تعديل عنصر** (إجراء "تعديل"): اسمه ومعرّفه النصي. نفس محتوى الإضافة؛ و\`kind\` يجب أن تكون القائمة التي فيها العنصر أصلًا، وإلا \`400 TAXONOMY_KIND_MISMATCH\`: العنصر لا ينتقل إلى قائمة أخرى. يبقى موضعه. يعيد العنصر.

للمعرّف النصي القواعد نفسها كما في الإضافة (الفارغ يعني يُصنع من \`name.en\`) ويمكن أن يبقى كما هو. استخدام عنصر آخر في القائمة نفسها له يعيد \`409 TAXONOMY_SLUG_TAKEN\`. معرّف غير موجود يعيد \`404 TAXONOMY_TERM_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const MOVE_DESCRIPTION = `
**Moves an entry up or down** within its list (the arrows of the page). Body: \`{ "direction": -1 }\` moves it up (earlier), \`{ "direction": 1 }\` moves it down. It swaps places with the entry above or below it. An entry already at that end stays where it is and the call still succeeds. The list is renumbered 1, 2, 3… with no gaps. Returns **all three lists** (like \`GET /admin/lists\`) so the page can refresh in one step.

Two admins moving entries of the same list at the same time are handled one after the other, so positions never repeat. An unknown id gives \`404 TAXONOMY_TERM_NOT_FOUND\`; any other \`direction\` gives \`400 VALIDATION_FAILED\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**نقل عنصر للأعلى أو للأسفل** داخل قائمته (أسهم الصفحة). المحتوى: \`{ "direction": -1 }\` ينقله للأعلى (أبكر) و\`{ "direction": 1 }\` ينقله للأسفل. يتبادل مكانه مع العنصر الذي فوقه أو تحته. العنصر الموجود أصلًا عند ذلك الطرف يبقى مكانه وينجح الطلب. تُعاد ترقيم القائمة 1 و2 و3… دون فجوات. يعيد **القوائم الثلاث** (مثل \`GET /admin/lists\`) لتتحدث الصفحة بخطوة واحدة.

إذا نقل مشرفان عناصر القائمة نفسها في الوقت نفسه فتُعالَج الطلبات واحدًا بعد الآخر فلا تتكرر المواضع. معرّف غير موجود يعيد \`404 TAXONOMY_TERM_NOT_FOUND\`؛ و\`direction\` غير ذلك يعيد \`400 VALIDATION_FAILED\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const DELETE_DESCRIPTION = `
**Deletes an entry** (the "delete" action) and closes the gap in its list's numbering. Returns **all three lists** (like \`GET /admin/lists\`). A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist (also one already deleted) gives \`404 TAXONOMY_TERM_NOT_FOUND\`.

Note: this edits the list shown here. Categories and regions are also fixed values elsewhere in the API (5 booking categories, 8 governorates), so deleting one here does not remove it from bookings, providers or heritage sites.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حذف عنصر** (إجراء "حذف") وسدّ الفجوة في ترقيم قائمته. يعيد **القوائم الثلاث** (مثل \`GET /admin/lists\`). \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود (أو محذوف سابقًا) يعيد \`404 TAXONOMY_TERM_NOT_FOUND\`.

تنبيه: هذا يعدّل القائمة المعروضة هنا. التصنيفات والمناطق قيم ثابتة أيضًا في أجزاء أخرى من الواجهة البرمجية (5 تصنيفات حجز و8 محافظات)، فحذف عنصر هنا لا يزيله من الحجوزات أو المزوّدين أو المواقع التراثية.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const NOT_FOUND = '`TAXONOMY_TERM_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Entry id from `GET /admin/lists`.' };

export const ListTaxonomyDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Categories, amenities and regions', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: [AdminTaxonomyTermDto], description: 'Every entry, list by list, each list in order.' }),
  );

export const CreateTaxonomyTermDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add an entry to a list', description: CREATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: SaveTaxonomyTermDto }),
    ApiCreatedResponse({ type: AdminTaxonomyTermDto, description: 'The new entry, last in its list.' }),
    ApiConflictResponse({ type: ErrorResponseDto, description: '`TAXONOMY_SLUG_TAKEN` or `TAXONOMY_LIMIT_REACHED`' }),
  );

export const UpdateTaxonomyTermDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Edit an entry', description: UPDATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiBody({ type: SaveTaxonomyTermDto }),
    ApiOkResponse({ type: AdminTaxonomyTermDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
    ApiConflictResponse({ type: ErrorResponseDto, description: '`TAXONOMY_SLUG_TAKEN`' }),
  );

export const MoveTaxonomyTermDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Move an entry up or down', description: MOVE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiBody({ type: MoveTaxonomyTermDto }),
    ApiOkResponse({ type: [AdminTaxonomyTermDto], description: 'Every entry, list by list, in the new order.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const DeleteTaxonomyTermDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an entry', description: DELETE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: [AdminTaxonomyTermDto], description: 'Every entry that is left, list by list, in order.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );
