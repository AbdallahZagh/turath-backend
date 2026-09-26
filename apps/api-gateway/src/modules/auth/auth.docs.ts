import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ERRORS_NOTE, rtl, SESSION_NOTE, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';
import { AuthResponseDto, OtpDispatchDto } from './dto/auth-response.dto.js';

/** Swagger docs for the auth endpoints: one decorator per endpoint, used as `@RegisterDocs()`. */

const REGISTER_DESCRIPTION = `
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

const LOGIN_EMAIL_DESCRIPTION = `
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

const LOGIN_PHONE_DESCRIPTION = `
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

const LOGIN_PHONE_VERIFY_DESCRIPTION = `
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

const OTP_SEND_DESCRIPTION = `
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

const OTP_VERIFY_DESCRIPTION = `
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

const PASSWORD_FORGOT_DESCRIPTION = `
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

const PASSWORD_RESET_DESCRIPTION = `
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

const signedInResponse = (description: string) => ApiOkResponse({ type: AuthResponseDto, description });

export const RegisterDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a tourist or provider account and send a verification code to the phone',
      description: REGISTER_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    ApiCreatedResponse({
      type: OtpDispatchDto,
      description: 'Account created (unverified); a 6-digit code was sent by SMS.',
    }),
    ApiConflictResponse({
      type: ErrorResponseDto,
      description: '`PHONE_TAKEN` or `EMAIL_TAKEN` (a verified account already uses it)',
    }),
  );

export const LoginEmailDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Sign in with email and password (no code). Returns the access and refresh tokens.',
      description: LOGIN_EMAIL_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    signedInResponse('Signed in. Session cookies are set as well.'),
    ApiUnauthorizedResponse({ type: ErrorResponseDto, description: '`INVALID_CREDENTIALS`' }),
    ApiForbiddenResponse({ type: ErrorResponseDto, description: '`ACCOUNT_NOT_VERIFIED` or `ACCOUNT_LOCKED`' }),
  );

export const LoginPhoneDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Phone login, step 1: send a 6-digit code by SMS (returned as devCode for now)',
      description: LOGIN_PHONE_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: OtpDispatchDto,
      description: 'Code sent (or silently skipped if the number is not registered).',
    }),
  );

export const LoginPhoneVerifyDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Phone login, step 2: exchange the code for the access and refresh tokens',
      description: LOGIN_PHONE_VERIFY_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    signedInResponse('Signed in. Session cookies are set as well.'),
    ApiForbiddenResponse({ type: ErrorResponseDto, description: '`ACCOUNT_LOCKED`' }),
  );

export const SendOtpDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Resend a verification code to a phone or email', description: OTP_SEND_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: OtpDispatchDto, description: 'Code sent (or silently skipped if no account uses it).' }),
  );

export const VerifyOtpDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Confirm a code and sign in (finishes signup). Returns the access and refresh tokens.',
      description: OTP_VERIFY_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    signedInResponse('Verified and signed in. Session cookies are set as well.'),
    ApiForbiddenResponse({ type: ErrorResponseDto, description: '`ACCOUNT_LOCKED`' }),
  );

export const ForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Password reset, step 1: send a reset code to the phone or email',
      description: PASSWORD_FORGOT_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    ApiOkResponse({
      type: OtpDispatchDto,
      description: 'Reset code sent (or silently skipped if no account uses it).',
    }),
  );

export const ResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Password reset, step 2: set a new password with the reset code',
      description: PASSWORD_RESET_DESCRIPTION,
    }),
    ValidationErrorResponse(),
    ApiNoContentResponse({ description: 'Password changed.' }),
  );
