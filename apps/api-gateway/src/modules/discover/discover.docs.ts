import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { DISCOVER_MAX_LIMIT } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { DiscoverOptionsDto, DiscoverPageDto } from './dto/discover.dto.js';

/** Swagger docs for the landing page search widget. */

const SEARCH_EN = `
**The landing page search widget ("Where to next?") in one call.** \`tab\` (required) is the widget's tab: \`hotels\`, \`dining\` (tables), \`trips\`, \`events\` or \`guides\`. The other query fields are the widget's, and only the ones of the chosen tab count:

| Tab | Fields |
|---|---|
| \`hotels\` | \`governorate\`, \`checkIn\`, \`checkOut\`, \`guests\` (1–12, default 2) |
| \`dining\` | \`governorate\`, \`date\`, \`time\` (\`12:00\`, \`14:00\`, \`18:00\`, \`20:00\`; default \`12:00\`), \`partySize\` (1–20, default 2) |
| \`trips\` | \`governorate\`, \`date\`, \`seats\` (1–20, default 2) |
| \`events\` | \`governorate\`, \`date\`, \`qty\` (1–6, default 2) |
| \`guides\` | \`governorate\`, \`date\`, \`language\` (\`arabic\`, \`english\`, \`french\`, \`kurdish\`, \`turkish\`) |

**What matches:**
- **hotels:** one of its rooms holds all the guests. With a \`checkIn\`, it must also have a room free: its rooms in total must outnumber the bookings (pending, confirmed or checked in) that overlap the stay; a guest leaving on the check-in day doesn't count. \`checkOut\` (not before \`checkIn\`; the same day is one night) without \`checkIn\` is ignored. \`match\`: \`roomsFitting\`, \`fromPriceSyp\` (cheapest fitting room per night), \`nights\`, \`totalFromSyp\` (both \`null\` without dates).
- **dining:** a table that seats the party and offers the time slot; with a \`date\`, a fitting table not already held by a booking at that day and time. \`match\`: \`time\`, \`tablesFitting\`, \`zones\`.
- **trips:** at least \`seats\` seats left and, with a \`date\`, departing that day. \`match\`: \`title\`, \`date\` (the one asked for, otherwise the earliest), \`seatsLeft\`, \`priceSyp\`, \`pickup\`.
- **events:** a session with room for \`qty\` tickets whose per-person limit allows that many, on the \`date\` when given. \`match\`: up to three \`sessions\` (soonest first) and \`fromPriceSyp\`.
- **guides:** speaks the language (none chosen: everyone) and, with a \`date\`, isn't already booked that day. Guide profiles only list Arabic, English and French so far: Kurdish and Turkish find nobody. \`match\`: \`languages\`, \`hourlySyp\`, \`fullDaySyp\`.

Public: no sign-in and no key. Only **approved** businesses are returned, best rated first (then most reviewed, then by name), with the **same card** for every tab: \`id\`, \`category\`, \`name\`, \`governorate\`, \`description\`, \`rating\`, \`href\` and \`match\`. Paged with \`page\` and \`limit\` (1–${DISCOVER_MAX_LIMIT}, default 12); \`total\` counts every match. Nothing matching is \`200\` with \`items: []\`, never an error. Whatever the visitor leaves empty (or sends empty, \`?date=\`) is not filtered on.

A missing or unknown \`tab\`, a bad value (an unknown region, time or language, a date that isn't \`YYYY-MM-DD\`, a number outside the stepper's range) or an unknown parameter gives \`400 VALIDATION_FAILED\` with one translated message per field.

Answers are cached (30 seconds in browsers and the gateway, 60 in the service), so a business that was just approved, or a room that was just booked, can take up to a minute to show. Limited to 60 searches a minute per client.

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;

const SEARCH_AR = `
**أداة البحث في الصفحة الرئيسية ("إلى أين؟") في طلب واحد.** \`tab\` (مطلوب) هو تبويب الأداة: \`hotels\` أو \`dining\` (الطاولات) أو \`trips\` أو \`events\` أو \`guides\`. وباقي الحقول هي حقول الأداة، ولا يُعتدّ إلا بحقول التبويب المختار:

- \`hotels\`: \`governorate\` و\`checkIn\` و\`checkOut\` و\`guests\` (من 1 إلى 12، الافتراضي 2).
- \`dining\`: \`governorate\` و\`date\` و\`time\` (\`12:00\` أو \`14:00\` أو \`18:00\` أو \`20:00\`؛ الافتراضي \`12:00\`) و\`partySize\` (من 1 إلى 20، الافتراضي 2).
- \`trips\`: \`governorate\` و\`date\` و\`seats\` (من 1 إلى 20، الافتراضي 2).
- \`events\`: \`governorate\` و\`date\` و\`qty\` (من 1 إلى 6، الافتراضي 2).
- \`guides\`: \`governorate\` و\`date\` و\`language\` (\`arabic\` أو \`english\` أو \`french\` أو \`kurdish\` أو \`turkish\`).

**ما الذي يطابق:**
- **الفنادق:** إحدى غرفه تتسع لكل الضيوف. ومع \`checkIn\` يجب أن تتوفر غرفة: عدد غرفه الكلي أكبر من الحجوزات (المعلّقة أو المؤكدة أو التي سُجّل وصولها) المتداخلة مع الإقامة، ولا يُحتسب من يغادر في يوم الوصول. \`checkOut\` (لا يسبق \`checkIn\`؛ ونفس اليوم ليلة واحدة) دون \`checkIn\` يُتجاهل. \`match\`: \`roomsFitting\` و\`fromPriceSyp\` (أرخص غرفة مناسبة لليلة) و\`nights\` و\`totalFromSyp\` (كلاهما \`null\` دون تواريخ).
- **الطاولات:** طاولة تتسع للمجموعة وتقدّم الفترة الزمنية؛ ومع \`date\` طاولة مناسبة غير محجوزة في ذلك اليوم والوقت. \`match\`: \`time\` و\`tablesFitting\` و\`zones\`.
- **الرحلات:** بقي فيها \`seats\` مقاعد على الأقل، ومع \`date\` تنطلق في ذلك اليوم. \`match\`: \`title\` و\`date\` (المطلوب، وإلا الأقرب) و\`seatsLeft\` و\`priceSyp\` و\`pickup\`.
- **الفعاليات:** جلسة تتسع لـ\`qty\` تذاكر وحدّها للشخص يسمح بذلك، وفي \`date\` إذا أُعطي. \`match\`: حتى ثلاث جلسات (الأقرب أولًا) و\`fromPriceSyp\`.
- **المرشدون:** يتحدث اللغة (دون اختيار: الجميع)، ومع \`date\` لا يكون محجوزًا في ذلك اليوم. ملفات المرشدين لا تذكر حتى الآن سوى العربية والإنجليزية والفرنسية: الكردية والتركية لا تجد أحدًا. \`match\`: \`languages\` و\`hourlySyp\` و\`fullDaySyp\`.

عام: دون تسجيل دخول ودون مفتاح. تُعاد المنشآت **المعتمدة** فقط، الأعلى تقييمًا أولًا (ثم الأكثر تقييمات، ثم بالاسم)، وبـ**البطاقة نفسها** في كل تبويب: \`id\` و\`category\` و\`name\` و\`governorate\` و\`description\` و\`rating\` و\`href\` و\`match\`. مع ترقيم \`page\` و\`limit\` (من 1 إلى ${DISCOVER_MAX_LIMIT}، الافتراضي 12)؛ و\`total\` يعدّ كل المطابقات. عدم وجود مطابقات يعيد \`200\` مع \`items: []\` وليس خطأ. ما يتركه الزائر فارغًا (أو يرسله فارغًا \`?date=\`) لا يُفلتَر عليه.

\`tab\` مفقود أو غير معروف، أو قيمة خاطئة (منطقة أو وقت أو لغة غير معروفة، أو تاريخ ليس بصيغة \`YYYY-MM-DD\`، أو رقم خارج نطاق العدّاد) أو معامل غير معروف يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل.

الإجابات مخزَّنة مؤقتًا (30 ثانية في المتصفح والبوابة و60 في الخدمة)، فقد تتأخر منشأة اعتُمدت للتو أو غرفة حُجزت للتو حتى دقيقة. الحد 60 عملية بحث في الدقيقة لكل عميل.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;

export const SearchDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'The landing page search widget: one call, pick the tab',
      description: `${SEARCH_EN}${rtl(SEARCH_AR)}`,
    }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: DiscoverPageDto }),
  );

const OPTIONS_EN = `
**Describes the search widget**, so the frontend can draw it from the API: \`tabs\` (hotels, dining, trips, events, guides, in that order) each with its \`href\` (the page it leads to) and its \`fields\` in the order the widget shows them: \`governorate\` (select), dates (\`checkIn\`, \`checkOut\`, \`date\`), \`time\` (with its \`options\` and \`default\`), \`language\` (with its \`options\`) and the steppers (\`guests\`, \`partySize\`, \`seats\`, \`qty\`, each with \`min\`, \`max\` and \`default\`). \`governorates\` are the regions to choose from, in the order the admin set them, with both names.

Public and cached. Every field id is the query parameter of the matching \`GET /discover\`.`;

const OPTIONS_AR = `
**يصف أداة البحث** لتُرسم الواجهة من الـAPI: \`tabs\` (الفنادق والمطاعم والرحلات والفعاليات والمرشدون بهذا الترتيب) ولكلٍّ \`href\` (الصفحة التي يقود إليها) و\`fields\` بالترتيب الذي تعرضه الأداة: \`governorate\` (قائمة) والتواريخ (\`checkIn\` و\`checkOut\` و\`date\`) و\`time\` (مع \`options\` و\`default\`) و\`language\` (مع \`options\`) والعدّادات (\`guests\` و\`partySize\` و\`seats\` و\`qty\`، لكلٍّ \`min\` و\`max\` و\`default\`). و\`governorates\` هي المناطق للاختيار بترتيب الإدارة وبالاسمين.

عام ومخزَّن مؤقتًا. كل معرّف حقل هو معامل الاستعلام في \`GET /discover\` المقابل.`;

export const DiscoverOptionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'The search widget: tabs, fields, limits and regions',
      description: `${OPTIONS_EN}${rtl(OPTIONS_AR)}`,
    }),
    ApiOkResponse({ type: DiscoverOptionsDto }),
  );
