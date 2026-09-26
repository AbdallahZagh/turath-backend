import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { AppException, DEFAULT_LOCALE, ErrorCode, isLocale } from '@turath/common';
import {
  IdentityPatterns,
  type AuthResult,
  type ClientInfo,
  type OtpDispatch,
  type SessionView,
  type UserView,
} from '@turath/contracts';
import { IdentityClient } from '../infra/identity.client.js';
import { AuthCookies } from './auth.cookies.js';
import { type AuthUser, CurrentUser, Public } from './auth.decorators.js';
import {
  AuthResponseDto,
  ErrorResponseDto,
  ForgotPasswordDto,
  LoginEmailDto,
  OtpDispatchDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SendOtpDto,
  SessionDto,
  UserDto,
  VerifyOtpDto,
} from './auth.dto.js';

/** Code-sending endpoints: 5 per minute per IP (identity also caps 3 per number per 15 min). */
const OTP_LIMIT = { default: { limit: 5, ttl: 60_000 } };
const LOGIN_LIMIT = { default: { limit: 10, ttl: 60_000 } };

const MOBILE_HEADER = 'x-client-type';

@ApiTags('auth')
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation failed (messages are translated)' })
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly identity: IdentityClient,
    private readonly cookies: AuthCookies,
  ) {}

  @Public()
  @Throttle(OTP_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Tourist signup. Sends a code to the phone; finish with POST /auth/otp/verify.' })
  @ApiOkResponse({ type: OtpDispatchDto })
  register(@Body() dto: RegisterDto): Promise<OtpDispatch> {
    const lang = I18nContext.current()?.lang;
    return this.identity.send(IdentityPatterns.REGISTER, {
      fullName: dto.name,
      dateOfBirth: dto.dateOfBirth,
      nationality: dto.nationality,
      phone: dto.phone,
      phoneCountry: dto.phoneCountry,
      email: dto.email,
      password: dto.password,
      locale: isLocale(lang) ? lang : DEFAULT_LOCALE,
    });
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/email')
  @ApiOperation({ summary: 'Email + password. On success a code is emailed; finish with POST /auth/otp/verify.' })
  @ApiOkResponse({ type: OtpDispatchDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'INVALID_CREDENTIALS' })
  loginEmail(@Body() dto: LoginEmailDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.LOGIN_EMAIL, { email: dto.email, password: dto.password });
  }

  @Public()
  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('otp/send')
  @ApiOperation({ summary: 'Phone login, or resend a code. Answers the same whether or not the account exists.' })
  @ApiOkResponse({ type: OtpDispatchDto })
  sendOtp(@Body() dto: SendOtpDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.OTP_SEND, { channel: dto.channel, destination: dto.destination });
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  @ApiOperation({ summary: 'Exchange a code for a session. Sets the HttpOnly session cookies and the locale/theme cookies.' })
  @ApiHeader({ name: MOBILE_HEADER, required: false, description: '`mobile` to also receive the refresh token in the body' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const auth = await this.identity.send<AuthResult>(IdentityPatterns.OTP_VERIFY, {
      channel: dto.channel,
      destination: dto.destination,
      code: dto.code,
      client: clientInfo(req),
    });
    return this.respondWithSession(auth, req, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token. Reusing an old refresh token signs that session out.' })
  @ApiCookieAuth('refresh-cookie')
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = this.cookies.readRefresh(req) ?? dto.refreshToken;
    if (!refreshToken) throw new AppException(ErrorCode.REFRESH_TOKEN_MISSING);

    try {
      const auth = await this.identity.send<AuthResult>(IdentityPatterns.TOKEN_REFRESH, {
        refreshToken,
        client: clientInfo(req),
      });
      return this.respondWithSession(auth, req, res);
    } catch (error) {
      if (error instanceof AppException && error.getStatus() === HttpStatus.UNAUTHORIZED) {
        this.cookies.clearSession(res);
      }
      throw error;
    }
  }

  @Public()
  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('password/forgot')
  @ApiOperation({ summary: 'Send a reset link (valid 10 minutes). Answers the same whether or not the account exists.' })
  @ApiOkResponse({ type: OtpDispatchDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.PASSWORD_FORGOT, { channel: dto.channel, destination: dto.destination });
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password/reset')
  @ApiOperation({ summary: 'Set a new password with the reset token. Signs out every session.' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.identity.send(IdentityPatterns.PASSWORD_RESET, { token: dto.token, password: dto.password });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentUser() user: AuthUser): Promise<UserView> {
    return this.identity.send(IdentityPatterns.ME, { userId: user.id });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out this device' })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.identity.send(IdentityPatterns.LOGOUT, { userId: user.id, sessionId: user.sessionId });
    this.cookies.clearSession(res);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout/others')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out every other device' })
  logoutOthers(@CurrentUser() user: AuthUser): Promise<{ revoked: number }> {
    return this.identity.send(IdentityPatterns.LOGOUT_ALL, { userId: user.id, sessionId: user.sessionId });
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devices signed in to this account' })
  @ApiOkResponse({ type: [SessionDto] })
  sessions(@CurrentUser() user: AuthUser): Promise<SessionView[]> {
    return this.identity.send(IdentityPatterns.SESSIONS_LIST, { userId: user.id, sessionId: user.sessionId });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out one device' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    await this.identity.send(IdentityPatterns.SESSIONS_REVOKE, { userId: user.id, sessionId });
  }

  private respondWithSession(auth: AuthResult, req: Request, res: Response): AuthResponseDto {
    this.cookies.setSession(res, auth);
    const isMobile = req.headers[MOBILE_HEADER] === 'mobile';
    return {
      accessToken: auth.accessToken,
      accessTokenExpiresIn: auth.accessTokenExpiresIn,
      refreshTokenExpiresAt: auth.refreshTokenExpiresAt,
      user: auth.user,
      ...(isMobile && { refreshToken: auth.refreshToken }),
    };
  }
}

function clientInfo(req: Request): ClientInfo {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
