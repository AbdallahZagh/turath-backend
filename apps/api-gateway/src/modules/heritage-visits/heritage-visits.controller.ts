import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HeritageVisitPatterns, type HeritageVisitPayload } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited, rtl } from '../../core/docs/api-docs.js';
import { ErrorResponseDto } from '../../core/docs/error-response.dto.js';

const DESCRIPTION = `
**Counts one visit of a heritage site.** The attraction page calls it once when it opens. It feeds *Top attractions* on the admin dashboard. Public: no sign-in and no key. Answers \`204\` with no body.

Only published sites are counted. A draft or unknown \`slug\` gives \`404 HERITAGE_SITE_NOT_FOUND\`, the same for both, so nobody can tell whether a draft exists. Limited to 30 visits a minute per client.
${rtl(`
**يحسب زيارة واحدة لموقع تراثي.** تستدعيه صفحة المعلم مرة عند فتحها، ويغذّي قائمة *أكثر المعالم زيارة* في لوحة الإدارة. عام: دون تسجيل دخول ودون مفتاح. يردّ \`204\` دون محتوى.

تُحتسب المواقع المنشورة فقط. الـ \`slug\` لمسودة أو غير معروف يعيد \`404 HERITAGE_SITE_NOT_FOUND\` في الحالتين، فلا يعرف أحد إن كانت المسودة موجودة. الحد 30 زيارة في الدقيقة لكل عميل.
`)}`;

/** Visit counter for the dashboard's top attractions. */
@ApiTags('heritage-sites')
@RateLimited()
@Public()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('heritage-sites')
export class HeritageVisitsController {
  constructor(private readonly identity: IdentityClient) {}

  @Post(':slug/visits')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Count a visit of a heritage site', description: DESCRIPTION })
  @ApiParam({ name: 'slug', example: 'umayyad-mosque', description: 'The slug of a published heritage site.' })
  @ApiNoContentResponse({ description: 'Counted.' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: '`HERITAGE_SITE_NOT_FOUND` (draft or unknown slug)' })
  async visit(@Param('slug') slug: string): Promise<void> {
    await this.identity.send<{ recorded: true }, HeritageVisitPayload>(HeritageVisitPatterns.RECORD, { slug });
  }
}
