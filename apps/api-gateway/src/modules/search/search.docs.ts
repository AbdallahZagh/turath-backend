import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { SEARCH_MAX_DEPTH, SEARCH_MAX_LIMIT, SEARCH_MAX_WORDS } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { SearchPageDto } from './dto/search.dto.js';

/** Swagger docs for the global search. */

const DESCRIPTION = `
**Searches everything public at once**: published heritage sites, approved businesses (hotels, restaurants, trips, events, guides), the booking categories and the regions. No sign-in and no key: anyone can use it.

**How it matches** (English and Arabic alike; case, Arabic diacritics, the different ways of writing alef / ya / ta marbuta, Arabic-Indic digits and punctuation make no difference):

- Every word of \`q\` has to appear, in any order and in any part of a word (\`ppo cit\` finds *Aleppo Citadel*), in the name, the start of the description, the slug, the region's name (so \`damascus\` or \`دمشق\` finds what is in Damascus) or the category. The first ${SEARCH_MAX_WORDS} words count.
- A **one-word** query of 4+ characters also forgives typos of a title (\`citadle\` finds *Citadel*).
- A query of 2–3 characters finds titles that **start** with it. One character, or only punctuation, finds nothing (an empty list, not an error).

**Order:** an exact title first, then titles that start with the query, then a title word that starts with it, then the query inside a title, then matches only in the description; ties go to heritage sites, then businesses, then categories and regions. \`score\` says how well each matched.

**Filters** (optional, combine): \`type\` (\`heritageSite\`, \`provider\`, \`category\`, \`region\`), \`category\` (businesses of a booking category, and the category itself), \`governorate\` (what is in it).

**Paging:** \`page\` and \`limit\` (1–${SEARCH_MAX_LIMIT}, default 10). \`hasMore\` says whether the next page has more. Results deeper than ${SEARCH_MAX_DEPTH} (page × limit) are not available: refine the query or the filters instead.

Each result has \`type\`, \`id\`, \`slug\`, \`name\` (\`{ en, ar }\`), \`summary\`, \`imageSrc\`, \`category\`, \`governorate\`, \`href\` (where the frontend opens it) and \`score\`. Nothing private is searched or returned: no drafts, no businesses that are not approved, no owner names, phones, emails or addresses.

**Speed:** the search runs on its own index (a trigram index over the normalised text, kept in step with the sources by the database), never on the tables themselves, and answers are cached: an exact repeat comes from Redis in the gateway, a different page or filter of the same words from Redis in the service, and browsers and CDNs may keep a response for 30 seconds (\`Cache-Control: public, max-age=30\`). A new, changed or deleted heritage site or category shows up straight away; other changes within a minute. Limited to 60 searches a minute per client.

A missing or too short \`q\`, a \`q\` longer than 100 characters, a bad filter, a bad \`page\` / \`limit\` or an unknown parameter gives \`400 VALIDATION_FAILED\` with one translated message per field. **Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**يبحث في كل ما هو عام دفعة واحدة**: المواقع التراثية المنشورة، والمنشآت المعتمدة (فنادق ومطاعم ورحلات وفعاليات ومرشدون)، وتصنيفات الحجز، والمناطق. دون تسجيل دخول ودون مفتاح: يستطيع الجميع استخدامه.

**طريقة المطابقة** (بالإنجليزية والعربية معًا؛ لا فرق بين الأحرف الكبيرة والصغيرة، ولا بالتشكيل، ولا بصور كتابة الألف والياء والتاء المربوطة، ولا بالأرقام الهندية، ولا بعلامات الترقيم):

- يجب أن تظهر كل كلمة من \`q\`، بأي ترتيب وفي أي جزء من الكلمة (\`ppo cit\` تجد *Aleppo Citadel*)، في الاسم أو بداية الوصف أو الـ slug أو اسم المنطقة (فكتابة \`damascus\` أو \`دمشق\` تجد ما فيها) أو التصنيف. تُحتسب أول ${SEARCH_MAX_WORDS} كلمات.
- الاستعلام من **كلمة واحدة** بطول 4 أحرف فأكثر يسامح أيضًا في أخطاء كتابة العنوان (\`citadle\` تجد *Citadel*).
- الاستعلام من 2–3 أحرف يجد العناوين التي **تبدأ** به. حرف واحد، أو علامات ترقيم فقط، لا يجد شيئًا (قائمة فارغة وليس خطأ).

**الترتيب:** العنوان المطابق تمامًا أولًا، ثم العناوين التي تبدأ بالاستعلام، ثم كلمة في العنوان تبدأ به، ثم الاستعلام داخل العنوان، ثم المطابقات في الوصف فقط؛ وعند التساوي تتقدم المواقع التراثية ثم المنشآت ثم التصنيفات والمناطق. و\`score\` يبيّن جودة كل مطابقة.

**الفلاتر** (اختيارية وتُطبَّق معًا): \`type\` (\`heritageSite\` أو \`provider\` أو \`category\` أو \`region\`) و\`category\` (منشآت تصنيف حجز، والتصنيف نفسه) و\`governorate\` (ما فيها).

**ترقيم الصفحات:** \`page\` و\`limit\` (من 1 إلى ${SEARCH_MAX_LIMIT}، الافتراضي 10). و\`hasMore\` يبيّن هل في الصفحة التالية المزيد. النتائج الأعمق من ${SEARCH_MAX_DEPTH} (الصفحة × الحجم) غير متاحة: دقّق الاستعلام أو الفلاتر بدلًا من ذلك.

لكل نتيجة \`type\` و\`id\` و\`slug\` و\`name\` (\`{ en, ar }\`) و\`summary\` و\`imageSrc\` و\`category\` و\`governorate\` و\`href\` (حيث تفتحها الواجهة) و\`score\`. لا يُبحث في أي شيء خاص ولا يُعاد: لا مسودات ولا منشآت غير معتمدة ولا أسماء مالكين ولا هواتف ولا بريد ولا عناوين.

**السرعة:** يعمل البحث على فهرسه الخاص (فهرس trigram على النص الموحَّد، تُبقيه قاعدة البيانات متزامنًا مع المصادر) وليس على الجداول نفسها، والإجابات مخزَّنة مؤقتًا: التكرار الدقيق يأتي من Redis في البوابة، وصفحة أو فلتر آخر لنفس الكلمات من Redis في الخدمة، ويمكن للمتصفحات وشبكات التوزيع حفظ الاستجابة 30 ثانية (\`Cache-Control: public, max-age=30\`). موقع تراثي جديد أو معدّل أو محذوف، وكذلك التصنيفات، يظهر فورًا؛ وغير ذلك خلال دقيقة. الحد 60 عملية بحث في الدقيقة لكل عميل.

\`q\` مفقود أو أقصر من اللازم أو أطول من 100 حرف، أو فلتر أو \`page\` / \`limit\` غير صحيحين، أو معامل غير معروف، يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل. **الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const SearchDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Search everything public', description: DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: SearchPageDto,
      description: 'One page of results, best first; `items` is `[]` when nothing matches.',
    }),
  );
