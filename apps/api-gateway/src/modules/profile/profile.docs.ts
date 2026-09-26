import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { rtl, SIGNED_IN_NOTE, SignedIn } from '../../core/docs/api-docs.js';
import { UserDto } from './dto/user.dto.js';

/** Swagger docs for the profile endpoints. */

const PROFILE_DESCRIPTION = `
**The signed-in user's profile:** name, contact details, role, provider type, verification status and saved language / theme.

${SIGNED_IN_NOTE}
${rtl(`
**الملف الشخصي للمستخدم المسجّل دخوله:** الاسم وبيانات التواصل والدور ونوع مزوّد الخدمة وحالة التحقق واللغة والمظهر المحفوظان. يتطلب تسجيل الدخول.
`)}`;

export const ProfileDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Profile of the signed-in user', description: PROFILE_DESCRIPTION }),
    SignedIn(),
    ApiOkResponse({ type: UserDto }),
  );
