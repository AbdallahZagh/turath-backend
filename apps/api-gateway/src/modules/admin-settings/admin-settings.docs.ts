import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { DEFAULT_SETTINGS, MAX_CREDIT_CEILING_SYP } from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminSettingsDto } from './dto/admin-settings.dto.js';

/** Swagger docs for the admin settings API. */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.`;
const ERRORS_NOTE_AR = `**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.`;
const KEY_NOTE_AR = `**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.`;

const { creditCeilingsSyp: c, reliability: r } = DEFAULT_SETTINGS;
const money = (n: number) => n.toLocaleString('en-US');

const SECTIONS = `- \`creditCeilingsSyp\`: the most a business can owe the platform, per credit tier (\`new\`, \`established\`, \`enterprise\`), in whole Syrian pounds.
- \`reliability\`: the guest reliability score cutoffs, \`vipAtOrAbove\` > \`standardAtOrAbove\` > \`restrictedAtOrAbove\` (0–100), and \`lockSuspended\`: whether guests below the restricted cutoff are locked out.
- \`flags\`: \`otpChannel\` (\`sms\` or \`whatsapp\`, how one-time codes reach phones), \`webCheckIn\`, and the home page featuring switches \`featuringEnabled\` and \`featuredSlots\` (one switch for each of the eight slots).`;
const SECTIONS_AR = `- \`creditCeilingsSyp\`: أقصى ما يمكن أن تدين به المنشأة للمنصة لكل شريحة ائتمان (\`new\` و\`established\` و\`enterprise\`) بالليرة السورية كأعداد صحيحة.
- \`reliability\`: حدود درجة موثوقية الضيف \`vipAtOrAbove\` > \`standardAtOrAbove\` > \`restrictedAtOrAbove\` (من 0 إلى 100)، و\`lockSuspended\`: هل يُقفل الضيوف دون الحد المقيَّد.
- \`flags\`: \`otpChannel\` (\`sms\` أو \`whatsapp\`، طريقة وصول رموز التحقق إلى الهواتف) و\`webCheckIn\` ومفاتيح إبراز الصفحة الرئيسية \`featuringEnabled\` و\`featuredSlots\` (مفتاح لكل خانة من الخانات الثماني).`;

const GET_DESCRIPTION = `
**The settings page** (\`/admin/settings\`). Same shape as \`AdminSettings\` in the frontend's \`lib/mock/adminSettings.ts\`:

${SECTIONS}

Nothing has to be set up first: until an admin saves, you get the defaults (credit ceilings ${money(c.new)} / ${money(c.established)} / ${money(c.enterprise)} SYP; scores ${r.vipAtOrAbove} / ${r.standardAtOrAbove} / ${r.restrictedAtOrAbove} with locking on; \`sms\`; web check-in on; featuring and every slot on).

The featuring switches are the same ones as \`GET /admin/featured/slots\`: changing them here or there changes both. Not cached, so it is always current.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**صفحة الإعدادات** (\`/admin/settings\`). بنفس شكل \`AdminSettings\` في الواجهة الأمامية:

${SECTIONS_AR}

لا حاجة لإعداد مسبق: إلى أن يحفظ مشرف شيئًا تحصل على القيم الافتراضية (سقوف الائتمان ${money(c.new)} / ${money(c.established)} / ${money(c.enterprise)} ليرة؛ الدرجات ${r.vipAtOrAbove} / ${r.standardAtOrAbove} / ${r.restrictedAtOrAbove} مع تفعيل القفل؛ \`sms\`؛ تسجيل الوصول عبر الويب مفعّل؛ والإبراز وكل الخانات مفعّلة).

مفاتيح الإبراز هي نفسها في \`GET /admin/featured/slots\`: تغييرها من هنا أو من هناك يغيّر الاثنين. غير مخزَّنة مؤقتًا، فهي حديثة دائمًا.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

const SAVE_DESCRIPTION = `
**Saves the whole settings page** at once, all or nothing, and returns it as \`GET /admin/settings\` does. Send every field; nothing else is allowed in the body:

${SECTIONS}

**Rules.** Each credit ceiling is a whole number from 1 to ${money(MAX_CREDIT_CEILING_SYP)}. Each reliability cutoff is a whole number from 0 to 100, and they must go **down**: VIP above standard above restricted (otherwise the error is on \`reliability.vipAtOrAbove\` or \`reliability.standardAtOrAbove\`). \`otpChannel\` is \`sms\` or \`whatsapp\`. Every switch is \`true\` or \`false\`, and all eight slots must be present.

The featuring switches are saved together with the rest in one step, and are the same ones \`PUT /admin/featured/slots\` writes. Promotions already in a slot you switch off stay, but stop showing on the home page.

A missing or invalid field or an extra field gives \`400 VALIDATION_FAILED\` with one translated message per field (nested ones are named like \`reliability.vipAtOrAbove\` or \`flags.featuredSlots.pillar_hotels\`). Nothing is saved. Saving the values already stored succeeds; if two admins save at once, the last one wins.

${API_KEY_NOTE}

${ERRORS_NOTE}
${rtl(`
**حفظ صفحة الإعدادات كاملة** دفعة واحدة، إما كلها أو لا شيء، ويعيدها بنفس شكل \`GET /admin/settings\`. أرسل كل الحقول ولا يُسمح بغيرها:

${SECTIONS_AR}

**القواعد.** كل سقف ائتمان عدد صحيح من 1 إلى ${money(MAX_CREDIT_CEILING_SYP)}. وكل حد موثوقية عدد صحيح من 0 إلى 100، ويجب أن تتناقص: كبار العملاء فوق العادي فوق المقيَّد (وإلا يكون الخطأ على \`reliability.vipAtOrAbove\` أو \`reliability.standardAtOrAbove\`). \`otpChannel\` هو \`sms\` أو \`whatsapp\`. وكل مفتاح \`true\` أو \`false\`، ويجب وجود الخانات الثماني كلها.

تُحفظ مفاتيح الإبراز مع بقية الصفحة في خطوة واحدة، وهي نفسها التي يكتبها \`PUT /admin/featured/slots\`. العروض الموجودة في خانة تُوقفها تبقى لكنها تتوقف عن الظهور في الصفحة الرئيسية.

حقل مفقود أو غير صالح أو حقل إضافي يعيد \`400 VALIDATION_FAILED\` مع رسالة مترجمة لكل حقل (وتُسمّى الحقول المتداخلة مثل \`reliability.vipAtOrAbove\` أو \`flags.featuredSlots.pillar_hotels\`). ولا يُحفظ شيء. حفظ القيم المخزّنة نفسها ينجح؛ وإذا حفظ مشرفان في الوقت نفسه فالأخير هو المعتمد.

${KEY_NOTE_AR}

${ERRORS_NOTE_AR}
`)}`;

export const GetSettingsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'The settings page', description: GET_DESCRIPTION }),
    ApiOkResponse({ type: AdminSettingsDto }),
  );

export const SaveSettingsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Save the settings page', description: SAVE_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiBody({ type: AdminSettingsDto }),
    ApiOkResponse({ type: AdminSettingsDto, description: 'The settings as now stored.' }),
  );
