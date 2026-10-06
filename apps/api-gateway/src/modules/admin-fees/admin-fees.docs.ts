import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminFeesDto } from './dto/admin-fees.dto.js';

/** Swagger docs for the admin fees API. */

const GET_DESCRIPTION = `
**The fees page** (\`/admin/fees\`): the exchange rate and the commission the platform takes on each kind of booking. Same shape as \`AdminCommissions\` in the frontend's \`lib/mock/adminCommissions.ts\`:

- \`sypPerUsd\`: Syrian pounds per one US dollar, a whole number.
- \`rows\`: one \`{ category, rate }\` per category, always in the order \`hotels\`, \`dining\`, \`trips\`, \`events\`, \`guides\`. \`rate\` is a fraction (\`0.12\` is 12%).

Nothing has to be set up first: until an admin saves, you get the defaults (14,286 SYP per dollar; hotels 12%, dining 12%, trips 10%, events 12%, guides 8.5%).

The result is cached for up to 60 seconds and dropped as soon as the fees are saved.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**صفحة الرسوم** (\`/admin/fees\`): سعر الصرف والعمولة التي تأخذها المنصة على كل نوع من الحجوزات. بنفس شكل \`AdminCommissions\` في الواجهة الأمامية:

- \`sypPerUsd\`: عدد الليرات السورية مقابل دولار أمريكي واحد، عدد صحيح.
- \`rows\`: عنصر \`{ category, rate }\` لكل فئة، بالترتيب دائمًا \`hotels\` ثم \`dining\` ثم \`trips\` ثم \`events\` ثم \`guides\`. \`rate\` نسبة (\`0.12\` تعني 12%).

لا حاجة لإعداد مسبق: إلى أن يحفظ مشرف شيئًا تحصل على القيم الافتراضية (14,286 ليرة للدولار؛ الفنادق 12%، المطاعم 12%، الرحلات 10%، الفعاليات 12%، المرشدون 8.5%).

تُخزَّن النتيجة حتى 60 ثانية وتُمسح فور حفظ الرسوم.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

const SAVE_DESCRIPTION = `
**Saves the fees page:** the exchange rate and all five commission rates together, all or nothing. Returns the page as \`GET /admin/fees\` does.

- Body: \`{ "sypPerUsd": 14286, "rates": { "hotels": 0.12, "dining": 0.12, "trips": 0.1, "events": 0.12, "guides": 0.085 } }\`. Send every field; nothing else is allowed in the body.
- \`sypPerUsd\` is a whole number from 1 to 100,000,000.
- Each rate is a fraction from 0 to 1 with at most 4 decimals (\`0.085\` is 8.5%). The page shows percents, so divide by 100 before sending.
- Saving the values already stored succeeds and changes nothing. If two admins save at once, the last one wins.
- A missing or non-numeric field, a rate outside 0–1 or with more than 4 decimals, a non-integer exchange rate or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`rates.hotels\`). Nothing is saved.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**حفظ صفحة الرسوم:** سعر الصرف ومعدلات العمولة الخمسة معًا، إما كلها أو لا شيء. يعيد الصفحة بنفس شكل \`GET /admin/fees\`.

- المحتوى: \`{ "sypPerUsd": 14286, "rates": { "hotels": 0.12, "dining": 0.12, "trips": 0.1, "events": 0.12, "guides": 0.085 } }\`. أرسل كل الحقول، ولا يُسمح بغيرها.
- \`sypPerUsd\` عدد صحيح من 1 إلى 100,000,000.
- كل معدل نسبة من 0 إلى 1 بحد أقصى 4 منازل عشرية (\`0.085\` تعني 8.5%). الصفحة تعرض نسبًا مئوية، فاقسم على 100 قبل الإرسال.
- حفظ القيم المخزّنة نفسها ينجح دون أي تغيير. إذا حفظ مشرفان في الوقت نفسه فالأخير هو المعتمد.
- حقل مفقود أو غير رقمي، أو معدل خارج 0–1 أو بأكثر من 4 منازل عشرية، أو سعر صرف غير صحيح، أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`rates.hotels\`). ولا يُحفظ شيء.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\`.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const GetAdminFeesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Exchange rate and commission rates', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: AdminFeesDto }),
  );

export const SaveAdminFeesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save exchange rate and commission rates', description: SAVE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: AdminFeesDto, description: 'The fees as now stored.' }),
  );
