import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import {
  HERITAGE_COVER_MAX_DIMENSION,
  HERITAGE_GALLERY_MAX_DIMENSION,
  HERITAGE_GALLERY_MAX_IMAGES,
  HERITAGE_GALLERY_UPLOAD_MAX_FILES,
  HERITAGE_IMAGE_QUALITY,
} from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import {
  AdminHeritageSiteDto,
  AdminHeritageSitePageDto,
  CreateHeritageSiteDto,
  IMAGE_LIMITS,
  UpdateHeritageSiteDto,
  UploadedImageDto,
} from './dto/admin-heritage-site.dto.js';

/** Swagger docs for the admin heritage sites API. */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_NOTE_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_NOTE_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const IMAGE_RULES = `**Images.** A site has exactly one cover image (\`imageSrc\`, one link) and a gallery (\`gallery\`, an array of at most ${HERITAGE_GALLERY_MAX_IMAGES} links, none repeated). A link is an \`https://\` link or a path of the frontend starting with \`/\` (no spaces, up to 500 characters). Upload files with \`POST /admin/heritage-sites/images/cover\` (JPEG, PNG or WebP, up to ${IMAGE_LIMITS.coverMb} MB) and \`POST /admin/heritage-sites/images/gallery\` (up to ${HERITAGE_GALLERY_UPLOAD_MAX_FILES} files at a time, each up to ${IMAGE_LIMITS.galleryMb} MB), then send the returned \`url\` here. **Every upload is compressed on the server:** turned upright by its EXIF orientation, fitted inside ${HERITAGE_COVER_MAX_DIMENSION} px (cover) or ${HERITAGE_GALLERY_MAX_DIMENSION} px (gallery) without enlarging, stripped of all metadata (EXIF, GPS), and re-encoded as WebP (quality ${HERITAGE_IMAGE_QUALITY}); transparency is kept, and the original is stored only if compressing would make it bigger. The response gives the stored \`size\` next to the \`originalSize\`.`;
const IMAGE_RULES_AR = `**الصور.** للموقع صورة غلاف واحدة بالضبط (\`imageSrc\`، رابط واحد) ومعرض (\`gallery\`، مصفوفة من ${HERITAGE_GALLERY_MAX_IMAGES} روابط على الأكثر دون تكرار). الرابط هو رابط \`https://\` أو مسار من الواجهة يبدأ بـ \`/\` (دون مسافات وبحد أقصى 500 حرف). ارفع الملفات عبر \`POST /admin/heritage-sites/images/cover\` (JPEG أو PNG أو WebP حتى ${IMAGE_LIMITS.coverMb} ميغابايت) و\`POST /admin/heritage-sites/images/gallery\` (حتى ${HERITAGE_GALLERY_UPLOAD_MAX_FILES} ملفات في المرة، كل منها حتى ${IMAGE_LIMITS.galleryMb} ميغابايت)، ثم أرسل \`url\` المُعاد هنا. **يُضغط كل ملف مرفوع على الخادم:** يُعدَّل اتجاهه حسب EXIF، ويُلائم داخل ${HERITAGE_COVER_MAX_DIMENSION} بكسل (الغلاف) أو ${HERITAGE_GALLERY_MAX_DIMENSION} بكسل (المعرض) دون تكبير، وتُزال كل البيانات الوصفية (EXIF وGPS)، ويُعاد ترميزه بصيغة WebP (جودة ${HERITAGE_IMAGE_QUALITY})؛ تبقى الشفافية، ويُحفظ الأصل فقط إذا كان الضغط سيجعله أكبر. تعرض الاستجابة \`size\` المحفوظ بجانب \`originalSize\`.`;

const LIST_DESCRIPTION = `
**Lists heritage sites** for the table, cards and map of the heritage sites page, newest first, one page at a time: \`?page=\` (from 1, default 1) and \`?limit=\` (1–100, default 20). The response has \`items\`, \`page\`, \`limit\`, \`total\` and \`totalPages\`. A page past the end returns \`items: []\`, not an error.

Optional filters, matching the filter bar; they combine:

- \`governorate\`: \`damascus\`, \`aleppo\`, \`latakia\`, \`tartus\`, \`homs\`, \`hama\`, \`palmyra\` or \`bosra\`.
- \`status\`: \`published\` or \`draft\`.
- \`search\`: matches the name (English or Arabic) and the slug, ignoring case.

Each item has the same shape as \`AdminAttraction\` in the frontend's \`lib/mock/adminAttractions.ts\`.

A bad filter, a bad \`page\` / \`limit\` or an unknown query parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. **Caching:** pages are cached for up to 60 seconds and dropped as soon as a site changes.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**قائمة المواقع التراثية** للجدول والبطاقات والخريطة في صفحة المواقع التراثية، الأحدث أولًا، صفحة بصفحة: \`?page=\` (يبدأ من 1، الافتراضي 1) و\`?limit=\` (من 1 إلى 100، الافتراضي 20). تحتوي الاستجابة على \`items\` و\`page\` و\`limit\` و\`total\` و\`totalPages\`. الصفحة بعد الأخيرة تعيد \`items: []\` وليست خطأ.

فلاتر اختيارية تطابق شريط الفلاتر، وتُطبَّق معًا:

- \`governorate\`: \`damascus\` أو \`aleppo\` أو \`latakia\` أو \`tartus\` أو \`homs\` أو \`hama\` أو \`palmyra\` أو \`bosra\`.
- \`status\`: \`published\` أو \`draft\`.
- \`search\`: يطابق الاسم (بالإنجليزية أو العربية) والمعرّف النصي slug، دون تمييز حالة الأحرف.

لكل عنصر نفس شكل \`AdminAttraction\` في الواجهة الأمامية.

فلتر غير صحيح أو \`page\` / \`limit\` غير صحيحين أو معامل غير معروف يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. **التخزين المؤقت:** تُخزَّن الصفحات حتى 60 ثانية وتُمسح فور تغيّر أي موقع.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const GET_DESCRIPTION = `
**One heritage site** for the details page that opens from a row: same shape as an item of \`GET /admin/heritage-sites\`.

A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 HERITAGE_SITE_NOT_FOUND\`. Cached for up to 60 seconds and dropped as soon as a site changes.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**موقع تراثي واحد** لصفحة التفاصيل التي تُفتح من صف: بنفس شكل عنصر \`GET /admin/heritage-sites\`.

\`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 HERITAGE_SITE_NOT_FOUND\`. يُخزَّن حتى 60 ثانية ويُمسح فور تغيّر أي موقع.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const CREATE_DESCRIPTION = `
**Adds a heritage site** (the "add" action of the page). Same body as \`CreateAdminAttractionInput\` in the frontend mock. Returns the new site (\`201\`).

- \`name\` and \`narrative\`: \`{ en, ar }\`, both required (name 2–150 characters, narrative 1–2000), trimmed.
- \`governorate\`, \`opensAt\` / \`closesAt\` (\`HH:mm\`, 24h; closing earlier than opening means past midnight), \`entryFeeSyp\` (whole pounds, \`0\` is free), \`latitude\` (−90 to 90), \`longitude\` (−180 to 180) and \`published\` (\`false\` keeps a draft) are required.
- \`slug\` is made from \`name.en\` (letters and digits joined by dashes; \`-2\`, \`-3\`… when taken) and never changes.

${IMAGE_RULES}

A missing or invalid field, an extra field, a bad image link or too many gallery images gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`name.en\` or \`gallery.0\`). Nothing is saved.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**إضافة موقع تراثي** (إجراء "إضافة" في الصفحة). نفس محتوى \`CreateAdminAttractionInput\` في الواجهة الأمامية. يعيد الموقع الجديد (\`201\`).

- \`name\` و\`narrative\`: \`{ en, ar }\` والاثنان مطلوبان (الاسم من 2 إلى 150 حرفًا، والوصف من 1 إلى 2000)، مع إزالة الفراغات الزائدة.
- مطلوب أيضًا: \`governorate\` و\`opensAt\` / \`closesAt\` (\`HH:mm\` بنظام 24 ساعة؛ الإغلاق قبل الفتح يعني بعد منتصف الليل) و\`entryFeeSyp\` (ليرات صحيحة، \`0\` مجاني) و\`latitude\` (من −90 إلى 90) و\`longitude\` (من −180 إلى 180) و\`published\` (\`false\` يبقيه مسودة).
- \`slug\` يُصنع من \`name.en\` (أحرف وأرقام تفصل بينها شرطات؛ \`-2\` و\`-3\`… عند التكرار) ولا يتغيّر.

${IMAGE_RULES_AR}

حقل مفقود أو غير صالح أو حقل إضافي أو رابط صورة غير صالح أو معرض فيه صور أكثر من المسموح يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`name.en\` أو \`gallery.0\`). ولا يُحفظ شيء.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const UPDATE_DESCRIPTION = `
**Saves a heritage site** (the "edit" action of the page and the details page). Same body as \`UpdateAdminAttractionInput\`: every field is replaced, so send the whole site, and \`gallery\` is required (\`[]\` for none). The \`slug\` is kept. Returns the site.

Images that were on the site and are not in the new \`imageSrc\` / \`gallery\` are deleted from storage if they were uploaded through this API; links to the frontend or elsewhere are left alone.

${IMAGE_RULES}

Validation is the same as when adding. A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist gives \`404 HERITAGE_SITE_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حفظ موقع تراثي** (إجراء "تعديل" في الصفحة وصفحة التفاصيل). نفس محتوى \`UpdateAdminAttractionInput\`: تُستبدل كل الحقول، فأرسل الموقع كاملًا، و\`gallery\` مطلوبة (\`[]\` لعدم وجود صور). يبقى \`slug\` كما هو. يعيد الموقع.

الصور التي كانت على الموقع وليست في \`imageSrc\` / \`gallery\` الجديدة تُحذف من التخزين إذا كانت قد رُفعت عبر هذه الواجهة؛ أما الروابط إلى الواجهة الأمامية أو غيرها فلا تُمسّ.

${IMAGE_RULES_AR}

التحقق كما عند الإضافة. \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود يعيد \`404 HERITAGE_SITE_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const DELETE_DESCRIPTION = `
**Deletes a heritage site** (the "delete" action) and the images that were uploaded for it. Returns \`204\` with no body. A malformed \`id\` gives \`400 VALIDATION_FAILED\`; an id that doesn't exist (also one already deleted) gives \`404 HERITAGE_SITE_NOT_FOUND\`.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حذف موقع تراثي** (إجراء "حذف") مع الصور التي رُفعت له. يعيد \`204\` دون محتوى. \`id\` غير صالح يعيد \`400 VALIDATION_FAILED\`، ومعرّف غير موجود (أو محذوف سابقًا) يعيد \`404 HERITAGE_SITE_NOT_FOUND\`.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const UPLOAD_ERRORS = `Errors: \`400 IMAGE_REQUIRED\` (no file), \`400 TOO_MANY_IMAGES\` (more files than allowed or a wrong field name), \`413 IMAGE_TOO_LARGE\`, \`415 IMAGE_TYPE_UNSUPPORTED\` (the file must really be a JPEG, PNG or WebP; its name and \`Content-Type\` are not trusted), \`422 IMAGE_UNREADABLE\` (damaged, or over 40 million pixels), \`503 STORAGE_NOT_CONFIGURED\` (Supabase is not set up) and \`502 STORAGE_UPLOAD_FAILED\`.`;
const UPLOAD_ERRORS_AR = `الأخطاء: \`400 IMAGE_REQUIRED\` (لا ملف)، \`400 TOO_MANY_IMAGES\` (ملفات أكثر من المسموح أو اسم حقل خاطئ)، \`413 IMAGE_TOO_LARGE\`، \`415 IMAGE_TYPE_UNSUPPORTED\` (يجب أن يكون الملف فعلًا JPEG أو PNG أو WebP؛ لا يُعتمد على اسمه ولا على \`Content-Type\`)، \`422 IMAGE_UNREADABLE\` (تالف أو أكثر من 40 مليون بكسل)، \`503 STORAGE_NOT_CONFIGURED\` (Supabase غير مُعدّ) و\`502 STORAGE_UPLOAD_FAILED\`.`;

const COVER_DESCRIPTION = `
**Uploads the cover image** of a heritage site to Supabase Storage. Send \`multipart/form-data\` with **one** file in the field \`file\`: JPEG, PNG or WebP, up to ${IMAGE_LIMITS.coverMb} MB. The response has the public \`url\`: send it as \`imageSrc\` when you add or save the site.

An image uploaded but never saved on a site stays in storage. ${UPLOAD_ERRORS}

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**رفع صورة الغلاف** لموقع تراثي إلى Supabase Storage. أرسل \`multipart/form-data\` مع **ملف واحد** في الحقل \`file\`: JPEG أو PNG أو WebP حتى ${IMAGE_LIMITS.coverMb} ميغابايت. تحتوي الاستجابة على \`url\` العام: أرسله كـ \`imageSrc\` عند إضافة الموقع أو حفظه.

الصورة المرفوعة التي لا تُحفظ على موقع تبقى في التخزين. ${UPLOAD_ERRORS_AR}

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const GALLERY_DESCRIPTION = `
**Uploads gallery photos** to Supabase Storage. Send \`multipart/form-data\` with up to ${HERITAGE_GALLERY_UPLOAD_MAX_FILES} files in the field \`files\`: JPEG, PNG or WebP, each up to ${IMAGE_LIMITS.galleryMb} MB. The response is an array in the same order, each with its public \`url\`: add them to \`gallery\` (a site holds at most ${HERITAGE_GALLERY_MAX_IMAGES}).

All files are checked before any is stored, and if one fails to store the rest of that request are removed again. ${UPLOAD_ERRORS}

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**رفع صور المعرض** إلى Supabase Storage. أرسل \`multipart/form-data\` مع حتى ${HERITAGE_GALLERY_UPLOAD_MAX_FILES} ملفات في الحقل \`files\`: JPEG أو PNG أو WebP، كل منها حتى ${IMAGE_LIMITS.galleryMb} ميغابايت. الاستجابة مصفوفة بالترتيب نفسه، لكل صورة \`url\` عام: أضفها إلى \`gallery\` (يتّسع الموقع لـ ${HERITAGE_GALLERY_MAX_IMAGES} على الأكثر).

تُفحص كل الملفات قبل حفظ أي منها، وإذا تعذّر حفظ أحدها تُحذف بقية ملفات الطلب.  ${UPLOAD_ERRORS_AR}

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const NOT_FOUND = '`HERITAGE_SITE_NOT_FOUND`, or `NOT_FOUND` for a missing or wrong `x-api-key`';
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Heritage site id from `GET /admin/heritage-sites`.' };

const uploadFailures = () =>
  applyDecorators(
    ApiResponse({
      status: 400,
      type: ErrorResponseDto,
      description: '`IMAGE_REQUIRED`, `TOO_MANY_IMAGES` or `VALIDATION_FAILED`',
    }),
    ApiResponse({ status: 413, type: ErrorResponseDto, description: '`IMAGE_TOO_LARGE`' }),
    ApiResponse({ status: 415, type: ErrorResponseDto, description: '`IMAGE_TYPE_UNSUPPORTED`' }),
    ApiResponse({ status: 422, type: ErrorResponseDto, description: '`IMAGE_UNREADABLE`' }),
    ApiResponse({ status: 502, type: ErrorResponseDto, description: '`STORAGE_UPLOAD_FAILED`' }),
    ApiResponse({ status: 503, type: ErrorResponseDto, description: '`STORAGE_NOT_CONFIGURED`' }),
  );

export const ListHeritageSitesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List heritage sites (paged, filterable)', description: LIST_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: AdminHeritageSitePageDto,
      description: 'One page of sites; `items` is `[]` past the last page.',
    }),
  );

export const GetHeritageSiteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'One heritage site', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiOkResponse({ type: AdminHeritageSiteDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const CreateHeritageSiteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add a heritage site', description: CREATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: CreateHeritageSiteDto }),
    ApiCreatedResponse({ type: AdminHeritageSiteDto, description: 'The new site.' }),
  );

export const UpdateHeritageSiteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save a heritage site', description: UPDATE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiBody({ type: UpdateHeritageSiteDto }),
    ApiOkResponse({ type: AdminHeritageSiteDto, description: 'The site as saved.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const DeleteHeritageSiteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a heritage site', description: DELETE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiParam(ID_PARAM),
    ApiNoContentResponse({ description: 'Deleted.' }),
    ApiNotFoundResponse({ type: ErrorResponseDto, description: NOT_FOUND }),
  );

export const UploadCoverImageDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Upload the cover image', description: COVER_DESCRIPTION }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary', description: 'One JPEG, PNG or WebP, up to 5 MB.' } },
      },
    }),
    ApiCreatedResponse({ type: UploadedImageDto }),
    uploadFailures(),
  );

export const UploadGalleryImagesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Upload gallery images', description: GALLERY_DESCRIPTION }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['files'],
        properties: {
          files: {
            type: 'array',
            maxItems: HERITAGE_GALLERY_UPLOAD_MAX_FILES,
            items: { type: 'string', format: 'binary' },
            description: `Up to ${HERITAGE_GALLERY_UPLOAD_MAX_FILES} JPEG, PNG or WebP files, each up to 5 MB.`,
          },
        },
      },
    }),
    ApiCreatedResponse({ type: [UploadedImageDto] }),
    uploadFailures(),
  );
