import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isLocale,
  isTheme,
  LOCALE_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE_MS,
  THEME_COOKIE,
  type Locale,
  type Theme,
} from '@turath/common';
import type { AuthResult } from '@turath/contracts';
import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_COOKIE = 'turath_at';
export const REFRESH_COOKIE = 'turath_rt';
/** The refresh cookie is only ever sent to the auth routes. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * All cookie writing lives here.
 *  - `turath_at` / `turath_rt`: HttpOnly session cookies (JS cannot read them).
 *  - `locale` / `theme`: readable by the frontend (next-intl / next-themes).
 * SameSite=Lax blocks cross-site POSTs, which is the CSRF protection for
 * cookie-authenticated requests.
 */
@Injectable()
export class AuthCookies {
  private readonly base: CookieOptions;

  constructor(config: ConfigService) {
    const domain = config.get<string>('COOKIE_DOMAIN');
    this.base = {
      sameSite: 'lax',
      secure: String(config.get('COOKIE_SECURE')) === 'true',
      ...(domain && { domain }),
    };
  }

  setSession(res: Response, auth: AuthResult): void {
    res.cookie(ACCESS_COOKIE, auth.accessToken, {
      ...this.base,
      httpOnly: true,
      path: '/',
      maxAge: auth.accessTokenExpiresIn * 1000,
    });
    res.cookie(REFRESH_COOKIE, auth.refreshToken, {
      ...this.base,
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
      expires: new Date(auth.refreshTokenExpiresAt),
    });
    // Preferences follow the account from device to device.
    this.setPreferences(res, { locale: auth.user.locale, theme: auth.user.theme });
  }

  clearSession(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...this.base, httpOnly: true, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.base, httpOnly: true, path: REFRESH_COOKIE_PATH });
  }

  setPreferences(res: Response, prefs: { locale?: Locale; theme?: Theme }): void {
    const options: CookieOptions = { ...this.base, httpOnly: false, path: '/', maxAge: PREFERENCE_COOKIE_MAX_AGE_MS };
    if (prefs.locale) res.cookie(LOCALE_COOKIE, prefs.locale, options);
    if (prefs.theme) res.cookie(THEME_COOKIE, prefs.theme, options);
  }

  readPreferences(req: Request): { locale?: Locale; theme?: Theme } {
    const cookies = (req.cookies ?? {}) as Record<string, unknown>;
    return {
      locale: isLocale(cookies[LOCALE_COOKIE]) ? cookies[LOCALE_COOKIE] : undefined,
      theme: isTheme(cookies[THEME_COOKIE]) ? cookies[THEME_COOKIE] : undefined,
    };
  }
}
