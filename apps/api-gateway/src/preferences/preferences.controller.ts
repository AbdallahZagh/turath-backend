import { Body, Controller, Get, Put, Req, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { DEFAULT_LOCALE, DEFAULT_THEME, isLocale, type Locale, type Theme } from '@turath/common';
import { IdentityPatterns } from '@turath/contracts';
import { AuthCookies } from '../auth/auth.cookies.js';
import { type AuthUser, CurrentUser, Public } from '../auth/auth.decorators.js';
import { ErrorResponseDto, PreferencesDto, UpdatePreferencesDto } from '../auth/auth.dto.js';
import { PREFERENCES_GET_DESCRIPTION, PREFERENCES_UPDATE_DESCRIPTION } from '../docs.js';
import { IdentityClient } from '../infra/identity.client.js';

const dirFor = (locale: Locale): 'ltr' | 'rtl' => (locale === 'ar' ? 'rtl' : 'ltr');

/**
 * Language + theme live in plain (non-HttpOnly) cookies that the frontend
 * also reads: `locale` (next-intl) and `theme` (light | dark | system).
 * When signed in, changes are also saved on the account so they follow the
 * user to other devices (re-applied at login).
 */
@ApiTags('preferences')
@Public()
@Controller('preferences')
export class PreferencesController {
  constructor(
    private readonly cookies: AuthCookies,
    private readonly identity: IdentityClient,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current language, text direction and theme', description: PREFERENCES_GET_DESCRIPTION })
  @ApiOkResponse({ type: PreferencesDto })
  get(@Req() req: Request): PreferencesDto {
    const stored = this.cookies.readPreferences(req);
    const resolved = I18nContext.current()?.lang;
    const locale: Locale = stored.locale ?? (isLocale(resolved) ? resolved : DEFAULT_LOCALE);
    return { locale, theme: stored.theme ?? DEFAULT_THEME, dir: dirFor(locale) };
  }

  @Put()
  @ApiOperation({
    summary: 'Change the language and/or theme (saved on the account when signed in)',
    description: PREFERENCES_UPDATE_DESCRIPTION,
  })
  @ApiOkResponse({ type: PreferencesDto, description: 'Preferences after the change; cookies are set.' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: '`VALIDATION_FAILED` (one translated message per field)' })
  async update(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthUser,
  ): Promise<PreferencesDto> {
    this.cookies.setPreferences(res, dto);
    if (user && (dto.locale || dto.theme)) {
      await this.identity.send(IdentityPatterns.PREFERENCES_UPDATE, { userId: user.id, ...dto });
    }

    const current = this.cookies.readPreferences(req);
    const locale: Locale = dto.locale ?? current.locale ?? DEFAULT_LOCALE;
    const theme: Theme = dto.theme ?? current.theme ?? DEFAULT_THEME;
    return { locale, theme, dir: dirFor(locale) };
  }
}
