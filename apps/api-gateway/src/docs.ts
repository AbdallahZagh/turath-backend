/**
 * Long-form Swagger descriptions (Markdown) for every public endpoint, in
 * English with an Arabic summary. Kept here so the controllers stay readable.
 */

const ERRORS_NOTE = `**Errors** are translated: send \`?lang=ar\`, the \`locale\` cookie, \`x-lang\` or \`Accept-Language\`. Validation failures return \`400 VALIDATION_FAILED\` with one message per field in \`errors\`; switch on \`code\`, not on the text.`;

const SESSION_NOTE = `**Response:** \`accessToken\` (send as \`Authorization: Bearer <token>\`, valid \`accessTokenExpiresIn\` seconds), \`refreshToken\` with \`refreshTokenExpiresAt\`, and the signed-in \`user\`. Web clients also get HttpOnly session cookies plus the \`locale\` / \`theme\` cookies, so they don't need to store the tokens themselves. Once the access token expires, sign in again.`;

const rtl = (text: string) => `\n---\n\n<div dir="rtl">\n\n${text.trim()}\n\n</div>\n`;

export const REGISTER_DESCRIPTION = `
Signs up a **tourist** or a **provider**. Every field is required, except \`providerType\`, which is required only for providers.

| Field | Rule |
|---|---|
| \`accountType\` | \`TOURIST\` or \`PROVIDER\` |
| \`providerType\` | Providers: \`RESTAURANT\` · \`HOTEL\` · \`TRIP_AGENCY\` · \`EVENT_MANAGER\` · \`TOUR_GUIDE\`. Tourists: omit or \`null\` |
| \`name\` | 2–100 letters (any language); spaces, \`-\`, \`'\` and \`.\` allowed |
| \`dateOfBirth\` | \`YYYY-MM-DD\`, in the past, from 1900 |
| \`nationality\`, \`phoneCountry\` | ISO 3166-1 alpha-2, e.g. \`SY\` |
| \`phone\` | National or international mobile number; stored as E.164 |
| \`email\` | Valid address, up to 150 characters |
| \`password\` | 8–128 characters, at least one letter and one number |

**Flow:** the account is created unverified and a 6-digit code is sent to the phone. Finish with \`POST /auth/otp/verify\` (\`channel: "phone"\`). Signing up again with the same phone or email before verifying replaces the unverified attempt.

${ERRORS_NOTE} Dropdown labels for \`accountType\` and \`providerType\` (EN/AR) come from \`GET /api/v1/meta\`.
${rtl(`
**إنشاء حساب سائح أو مزوّد خدمة.** جميع الحقول مطلوبة، ما عدا \`providerType\` فهو مطلوب لمزوّدي الخدمة فقط (مطعم، فندق، وكالة رحلات، منظّم فعاليات، مرشد سياحي) ويُحذف لحسابات السياح.

يُنشأ الحساب غير مُفعّل ويُرسَل رمز من 6 أرقام إلى الهاتف، ثم يُكمل التسجيل عبر \`POST /auth/otp/verify\`. رسائل الأخطاء والتحقق تصل بالعربية عند إرسال \`?lang=ar\` أو كوكي \`locale=ar\`.
`)}`;

export const LOGIN_EMAIL_DESCRIPTION = `
Signs in with **email and password** in one step. No code is sent.

| Field | Rule |
|---|---|
| \`email\` | Required. Valid address, case-insensitive |
| \`password\` | Required. Up to 128 characters |

${SESSION_NOTE}

**Fails with:**
- \`401 INVALID_CREDENTIALS\`: unknown email or wrong password (the same answer for both, so emails can't be discovered).
- \`403 ACCOUNT_NOT_VERIFIED\`: signup was never finished; verify the phone with \`POST /auth/otp/verify\` first.
- \`403 ACCOUNT_LOCKED\`: the account was locked by support.

${ERRORS_NOTE}
${rtl(`
**تسجيل الدخول بالبريد الإلكتروني وكلمة المرور** مباشرةً ومن دون رمز تحقق. يعيد الرد رمز الوصول \`accessToken\` ورمز التحديث \`refreshToken\` وبيانات المستخدم، ويضبط كوكيز الجلسة لتطبيق الويب.

الأخطاء: \`INVALID_CREDENTIALS\` عند خطأ البريد أو كلمة المرور، و\`ACCOUNT_NOT_VERIFIED\` إذا لم يُؤكَّد رقم الهاتف عند التسجيل، و\`ACCOUNT_LOCKED\` إذا كان الحساب مقفلًا.
`)}`;

export const LOGIN_PHONE_DESCRIPTION = `
**Step 1 of phone login:** sends a 6-digit code by SMS. Finish with \`POST /auth/login/phone/verify\`.

| Field | Rule |
|---|---|
| \`phoneCountry\` | Required. ISO 3166-1 alpha-2, e.g. \`SY\` |
| \`phone\` | Required. National (\`0944 123 456\`) or international (\`+963944123456\`) format |

The code is valid for \`expiresInSeconds\`; a new one can be requested after \`resendInSeconds\`. The answer looks the same whether or not the number is registered, so the endpoint can't be used to find accounts.

> **Temporary (development):** while \`OTP_DEV_ECHO=true\`, the code is also returned as \`devCode\`. SMS delivery isn't connected yet; this goes away in production.

${ERRORS_NOTE} Too many requests return \`429\` (\`OTP_COOLDOWN\` / \`TOO_MANY_REQUESTS\`) with the wait time in the message.
${rtl(`
**الخطوة الأولى لتسجيل الدخول برقم الهاتف:** يُرسَل رمز من 6 أرقام برسالة نصية، ثم يُكمل الدخول عبر \`POST /auth/login/phone/verify\`.

مؤقتًا وأثناء التطوير يظهر الرمز في الرد ضمن الحقل \`devCode\` إلى حين ربط خدمة الرسائل النصية.
`)}`;

export const LOGIN_PHONE_VERIFY_DESCRIPTION = `
**Step 2 of phone login:** exchanges the code from \`POST /auth/login/phone\` for a session.

| Field | Rule |
|---|---|
| \`phoneCountry\` | Required. Same value as step 1 |
| \`phone\` | Required. Same number as step 1 |
| \`code\` | Required. The 6 digits that were sent |

${SESSION_NOTE}

**Fails with:** \`400 OTP_INVALID\` (wrong code), \`400 OTP_EXPIRED\` (request a new one), \`429 OTP_TOO_MANY_ATTEMPTS\` (5 wrong tries; request a new code), \`403 ACCOUNT_LOCKED\`.

${ERRORS_NOTE}
${rtl(`
**الخطوة الثانية لتسجيل الدخول برقم الهاتف:** أرسل الرمز المكوّن من 6 أرقام لتحصل على رمز الوصول \`accessToken\` ورمز التحديث \`refreshToken\` وبيانات المستخدم.

الأخطاء: \`OTP_INVALID\` للرمز الخاطئ، و\`OTP_EXPIRED\` للرمز المنتهي، و\`OTP_TOO_MANY_ATTEMPTS\` بعد 5 محاولات خاطئة.
`)}`;

const SIGNED_IN_NOTE = `**Requires sign-in:** \`Authorization: Bearer <accessToken>\` (mobile / API clients) or the HttpOnly session cookie (web). Without it: \`401 UNAUTHORIZED\`; with an expired or signed-out session: \`401 SESSION_EXPIRED\`.`;

export const OTP_SEND_DESCRIPTION = `
**Resends a verification code** to a phone or email, e.g. when the signup SMS didn't arrive. For signing in by phone use \`POST /auth/login/phone\` instead.

| Field | Rule |
|---|---|
| \`channel\` | Required. \`phone\` or \`email\` |
| \`destination\` | Required. Mobile number for \`phone\` (national Syrian or international format), email address for \`email\` |

**Limits:** one code per \`resendInSeconds\` (60 s) per destination, and at most 3 codes per destination every 15 minutes. Otherwise \`429 OTP_COOLDOWN\` / \`TOO_MANY_REQUESTS\`, with the wait in the message.

The answer looks the same whether or not an account uses that phone or email. While \`OTP_DEV_ECHO=true\` the code is returned as \`devCode\` (temporary, development only).

${ERRORS_NOTE}
${rtl(`
**إعادة إرسال رمز التحقق** إلى الهاتف أو البريد الإلكتروني، مثلًا إذا لم تصل رسالة التسجيل. لتسجيل الدخول بالهاتف استخدم \`POST /auth/login/phone\`.

يمكن طلب رمز واحد كل 60 ثانية، وبحد أقصى 3 رموز كل 15 دقيقة لكل وجهة.
`)}`;

export const OTP_VERIFY_DESCRIPTION = `
**Confirms a code and signs in.** This is how signup is finished: send the code from \`POST /auth/register\` with \`channel: "phone"\`. A code sent to an email marks that email as verified.

| Field | Rule |
|---|---|
| \`channel\` | Required. \`phone\` or \`email\` (the same one the code was sent to) |
| \`destination\` | Required. The same phone or email |
| \`code\` | Required. The 6 digits |

${SESSION_NOTE}

**Fails with:** \`400 OTP_INVALID\` (wrong code), \`400 OTP_EXPIRED\` (request a new one), \`429 OTP_TOO_MANY_ATTEMPTS\` (5 wrong tries), \`403 ACCOUNT_LOCKED\`.

${ERRORS_NOTE}
${rtl(`
**تأكيد الرمز وتسجيل الدخول.** بهذه الخطوة يكتمل إنشاء الحساب: أرسل الرمز الذي وصل بعد \`POST /auth/register\` مع \`channel: "phone"\`. يعيد الرد رمز الوصول ورمز التحديث وبيانات المستخدم.
`)}`;

export const PASSWORD_FORGOT_DESCRIPTION = `
**Step 1 of a password reset:** sends a single-use reset code to the account's phone or email. Finish with \`POST /auth/password/reset\`.

| Field | Rule |
|---|---|
| \`channel\` | Required. \`phone\` or \`email\` |
| \`destination\` | Required. The account's phone number or email |

The code is valid for \`expiresInSeconds\` (10 minutes) and can be requested once a minute. The answer looks the same whether or not the account exists, so the endpoint can't be used to find accounts. While \`OTP_DEV_ECHO=true\` the code is returned as \`devCode\` (temporary, development only).

${ERRORS_NOTE}
${rtl(`
**الخطوة الأولى لاستعادة كلمة المرور:** يُرسَل رمز استعادة صالح لمرة واحدة ولمدة 10 دقائق إلى هاتف الحساب أو بريده، ثم تُكمل العملية عبر \`POST /auth/password/reset\`.
`)}`;

export const PASSWORD_RESET_DESCRIPTION = `
**Step 2 of a password reset:** sets a new password using the code from \`POST /auth/password/forgot\`. Devices that are already signed in stay signed in; use \`POST /auth/logout/others\` to sign them out.

| Field | Rule |
|---|---|
| \`token\` | Required. The reset code, exactly as received |
| \`password\` | Required. 8–128 characters, at least one letter and one number |

Returns \`204 No Content\`. The code works once; an invalid, used or expired code gives \`400 RESET_TOKEN_INVALID\`.

${ERRORS_NOTE}
${rtl(`
**الخطوة الثانية لاستعادة كلمة المرور:** عيّن كلمة مرور جديدة (8 أحرف على الأقل، تحتوي على حرف ورقم) باستخدام الرمز الذي وصلك. تبقى الأجهزة المسجّلة حاليًا مسجّلة الدخول.
`)}`;

export const PROFILE_DESCRIPTION = `
**The signed-in user's profile:** name, contact details, role, provider type, verification status and saved language / theme.

${SIGNED_IN_NOTE}
${rtl(`
**الملف الشخصي للمستخدم المسجّل دخوله:** الاسم وبيانات التواصل والدور ونوع مزوّد الخدمة وحالة التحقق واللغة والمظهر المحفوظان. يتطلب تسجيل الدخول.
`)}`;

export const LOGOUT_DESCRIPTION = `
**Signs out this device.** The access token stops working immediately and the session cookies are cleared. Returns \`204 No Content\`.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من هذا الجهاز.** يتوقف رمز الوصول عن العمل فورًا وتُحذف كوكيز الجلسة.
`)}`;

export const LOGOUT_OTHERS_DESCRIPTION = `
**Signs out every other device** on this account; this one stays signed in. Returns how many sessions were ended.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من جميع الأجهزة الأخرى** مع بقاء هذا الجهاز مسجّل الدخول. يعيد عدد الجلسات التي أُنهيت.
`)}`;

export const SESSIONS_DESCRIPTION = `
**Lists the devices signed in to this account**, most recent first, with browser / app (\`userAgent\`), IP and times. \`current: true\` marks the device making the request.

${SIGNED_IN_NOTE}
${rtl(`
**قائمة الأجهزة المسجّلة الدخول إلى هذا الحساب** مع المتصفح أو التطبيق وعنوان IP والأوقات. الجهاز الحالي عليه \`current: true\`.
`)}`;

export const SESSION_REVOKE_DESCRIPTION = `
**Signs out one device** using an \`id\` from \`GET /auth/sessions\`. Returns \`204 No Content\`.

A malformed id gives \`400 VALIDATION_FAILED\`; an id that isn't signed in on this account gives \`404 SESSION_NOT_FOUND\`.

${SIGNED_IN_NOTE}
${rtl(`
**تسجيل الخروج من جهاز واحد** باستخدام المعرّف \`id\` من \`GET /auth/sessions\`.
`)}`;

export const PREFERENCES_GET_DESCRIPTION = `
**Current language, text direction and theme.** Works signed in or not: values come from the \`locale\` and \`theme\` cookies, falling back to the request language and \`system\`.

${rtl(`
**اللغة واتجاه النص والمظهر الحالية.** تعمل مع تسجيل الدخول أو بدونه، وتُقرأ القيم من الكوكيز \`locale\` و\`theme\`.
`)}`;

export const PREFERENCES_UPDATE_DESCRIPTION = `
**Changes the language and/or theme.** Both fields are optional; send only what changes.

| Field | Rule |
|---|---|
| \`locale\` | Optional. \`en\` or \`ar\` |
| \`theme\` | Optional. \`light\`, \`dark\` or \`system\` |

Sets the \`locale\` / \`theme\` cookies (read by the frontend). When signed in, the choice is also saved on the account and restored on other devices at sign-in. Returns the resulting preferences.

${ERRORS_NOTE}
${rtl(`
**تغيير اللغة و/أو المظهر.** كلا الحقلين اختياري. تُحفظ القيم في الكوكيز، وعند تسجيل الدخول تُحفظ أيضًا في الحساب لتنتقل إلى أجهزتك الأخرى.
`)}`;

export const META_DESCRIPTION = `
**App metadata for building the UI:** supported languages (with text direction), themes, currencies, and the signup dropdowns (\`accountTypes\`, \`providerTypes\`). Labels are translated into the request language.

Public. Cached for an hour per language.

${rtl(`
**بيانات التطبيق لبناء الواجهة:** اللغات المدعومة واتجاه النص والمظاهر والعملات وخيارات القوائم المنسدلة في التسجيل (نوع الحساب ونوع مزوّد الخدمة)، مع تسميات مترجمة حسب لغة الطلب.
`)}`;
