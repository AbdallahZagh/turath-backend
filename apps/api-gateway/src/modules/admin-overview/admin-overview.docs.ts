import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
  OVERVIEW_MAX_DAYS,
  OVERVIEW_MIN_DAYS,
  OVERVIEW_TOP_ATTRACTIONS,
  OVERVIEW_VOLUME_DAYS,
} from '@turath/contracts';
import { rtl, ValidationErrorResponse } from '../../core/docs/api-docs.js';
import { API_KEY_NOTE } from '../admin/admin.docs.js';
import { AdminOverviewDto } from './dto/admin-overview.dto.js';

/** Swagger docs for the admin dashboard home page. */

const GET_DESCRIPTION = `
**Everything the dashboard home page shows, in one call.** \`?days=\` is the period, counting back from today (${OVERVIEW_MIN_DAYS}–${OVERVIEW_MAX_DAYS}, default 30; the page offers 7, 30 and 90). A booking belongs to the period by the day of its visit (\`when.start\`), in UTC.

- \`kpis\`: \`grossBookingsSyp\` (value of the period's bookings, cancelled ones excluded), \`completedCount\`, \`noShowRate\` (no-shows ÷ completed + no-shows, a fraction), \`commissionRevenueSyp\` (the commission on the completed bookings: the business's own rate when it has one, otherwise the category's rate from the fees page), \`pendingProviders\` and \`openDisputes\` (both are right now, not limited to the period).
- \`volume\`: bookings per day for the **latest ${OVERVIEW_VOLUME_DAYS} days** whatever the period, oldest first, with every day present (0 when nothing was booked).
- \`noShowByCity\`: the no-show rate per region of the business, highest first; only regions that had a completed booking or a no-show.
- \`origins\`: each country's share of the period's guests (a guest counts once), biggest first and \`other\` last. The country is the guest's nationality, or the country of their phone number. Shares add up to 1.
- \`topAttractions\`: up to ${OVERVIEW_TOP_ATTRACTIONS} published heritage sites by visits in the period, with \`id\`, \`slug\`, \`name\`, \`governorate\` and \`visits\`. Visits are counted by \`POST /heritage-sites/{slug}/visits\`, which the attraction page calls; until it does, the list is empty.
- \`commissionByPillar\`: the commission per kind of booking; always the five kinds, hotels, dining, trips, events, guides. They add up to \`kpis.commissionRevenueSyp\`.

Money is in whole Syrian pounds; rates and shares are fractions (0.062 = 6.2%).

**Speed:** every figure is an aggregate over an indexed range of visit days, the queries run in parallel, and the answer is cached in Redis for a minute per period, so repeat loads cost no database work. A booking, dispute or business change shows up within a minute.

A \`days\` that isn't a whole number from ${OVERVIEW_MIN_DAYS} to ${OVERVIEW_MAX_DAYS}, or an unknown query parameter, gives \`400 VALIDATION_FAILED\`.

${API_KEY_NOTE}

**Errors** are translated: send \`?lang=ar\`, \`x-lang\` or \`Accept-Language\`. Switch on \`code\`, not on the text.
${rtl(`
**كل ما تعرضه الصفحة الرئيسية للوحة الإدارة في طلب واحد.** \`?days=\` هو الفترة بالأيام وصولًا إلى اليوم (من ${OVERVIEW_MIN_DAYS} إلى ${OVERVIEW_MAX_DAYS}، الافتراضي 30؛ والصفحة تعرض 7 و30 و90). يُحتسب الحجز في الفترة بيوم زيارته (\`when.start\`) بتوقيت UTC.

- \`kpis\`: \`grossBookingsSyp\` (قيمة حجوزات الفترة دون الملغاة) و\`completedCount\` و\`noShowRate\` (عدم الحضور ÷ المكتمل + عدم الحضور، كسر) و\`commissionRevenueSyp\` (عمولة الحجوزات المكتملة: نسبة المنشأة الخاصة إن وُجدت وإلا نسبة التصنيف من صفحة الرسوم) و\`pendingProviders\` و\`openDisputes\` (الاثنان للحظة الحالية وليسا مقيّدين بالفترة).
- \`volume\`: الحجوزات لكل يوم في **آخر ${OVERVIEW_VOLUME_DAYS} أيام** أيًّا كانت الفترة، من الأقدم، وكل الأيام موجودة (0 إن لم يُحجز شيء).
- \`noShowByCity\`: نسبة عدم الحضور لكل منطقة للمنشأة، الأعلى أولًا؛ للمناطق التي فيها حجز مكتمل أو عدم حضور فقط.
- \`origins\`: حصة كل بلد من ضيوف الفترة (يُحتسب الضيف مرة واحدة)، الأكبر أولًا و\`other\` أخيرًا. البلد هو جنسية الضيف أو بلد رقم هاتفه. مجموع الحصص 1.
- \`topAttractions\`: حتى ${OVERVIEW_TOP_ATTRACTIONS} مواقع تراثية منشورة بحسب الزيارات في الفترة، مع \`id\` و\`slug\` و\`name\` و\`governorate\` و\`visits\`. تُحتسب الزيارات عبر \`POST /heritage-sites/{slug}/visits\` الذي تستدعيه صفحة المعلم؛ وإلى أن تفعل تكون القائمة فارغة.
- \`commissionByPillar\`: العمولة لكل نوع حجز؛ دائمًا الأنواع الخمسة: فنادق ومطاعم ورحلات وفعاليات ومرشدون، ومجموعها \`kpis.commissionRevenueSyp\`.

المبالغ بالليرة السورية كأعداد صحيحة؛ والنسب والحصص كسور (0.062 = 6.2%).

**السرعة:** كل رقم هو تجميع على نطاق مفهرس من أيام الزيارة، وتعمل الاستعلامات بالتوازي، وتُخزَّن الإجابة في Redis دقيقة لكل فترة، فلا يكلّف التحميل المتكرر قاعدة البيانات شيئًا. يظهر تغيّر حجز أو نزاع أو منشأة خلال دقيقة.

قيمة \`days\` ليست عددًا صحيحًا من ${OVERVIEW_MIN_DAYS} إلى ${OVERVIEW_MAX_DAYS} أو معامل غير معروف تعيد \`400 VALIDATION_FAILED\`.

**يتطلب مفتاح الإدارة:** أرسل \`x-api-key: <key>\`. المفتاح المفقود أو الخاطئ يعيد \`404 NOT_FOUND\` كأي مسار غير موجود.

**الأخطاء** مترجمة: أرسل \`?lang=ar\` أو \`x-lang\` أو \`Accept-Language\`، واعتمد على \`code\` لا على النص.
`)}`;

export const GetOverviewDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Dashboard home page numbers', description: GET_DESCRIPTION }),
    ValidationErrorResponse(),
    ApiOkResponse({ type: AdminOverviewDto }),
  );
