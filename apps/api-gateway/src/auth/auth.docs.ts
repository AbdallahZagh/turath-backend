/**
 * Long-form Swagger descriptions (Markdown) for the auth endpoints, in English
 * and Arabic. Kept here so the controller stays readable.
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
