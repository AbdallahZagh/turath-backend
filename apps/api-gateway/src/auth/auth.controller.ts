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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { DEFAULT_LOCALE, isLocale } from '@turath/common';
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
import { LOGIN_EMAIL_DESCRIPTION, LOGIN_PHONE_DESCRIPTION, LOGIN_PHONE_VERIFY_DESCRIPTION, REGISTER_DESCRIPTION } from './auth.docs.js';
import { type AuthUser, CurrentUser, Public } from './auth.decorators.js';
import {
  AuthResponseDto,
  ErrorResponseDto,
  ForgotPasswordDto,
  LoginEmailDto,
  LoginPhoneDto,
  LoginPhoneVerifyDto,
  OtpDispatchDto,
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
  @ApiOperation({
    summary: 'Create a tourist or provider account and send a verification code to the phone',
    description: REGISTER_DESCRIPTION,
  })
  @ApiCreatedResponse({ type: OtpDispatchDto, description: 'Account created (unverified); a 6-digit code was sent by SMS.' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: '`PHONE_TAKEN` or `EMAIL_TAKEN` (a verified account already uses it)' })
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
      accountType: dto.accountType,
      providerType: dto.accountType === 'PROVIDER' ? (dto.providerType ?? null) : null,
      locale: isLocale(lang) ? lang : DEFAULT_LOCALE,
    });
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/email')
  @ApiOperation({
    summary: 'Sign in with email and password (no code). Returns the access and refresh tokens.',
    description: LOGIN_EMAIL_DESCRIPTION,
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Signed in. Session cookies are set as well.' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: '`INVALID_CREDENTIALS`' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: '`ACCOUNT_NOT_VERIFIED` or `ACCOUNT_LOCKED`' })
  async loginEmail(
    @Body() dto: LoginEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const auth = await this.identity.send<AuthResult>(IdentityPatterns.LOGIN_EMAIL, {
      email: dto.email,
      password: dto.password,
      client: clientInfo(req),
    });
    return this.respondWithSession(auth, res);
  }

  @Public()
  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/phone')
  @ApiOperation({
    summary: 'Phone login, step 1: send a 6-digit code by SMS (returned as devCode for now)',
    description: LOGIN_PHONE_DESCRIPTION,
  })
  @ApiOkResponse({ type: OtpDispatchDto, description: 'Code sent (or silently skipped if the number is not registered).' })
  loginPhone(@Body() dto: LoginPhoneDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.OTP_SEND, { channel: 'phone', destination: dto.phone });
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/phone/verify')
  @ApiOperation({
    summary: 'Phone login, step 2: exchange the code for the access and refresh tokens',
    description: LOGIN_PHONE_VERIFY_DESCRIPTION,
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Signed in. Session cookies are set as well.' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: '`ACCOUNT_LOCKED`' })
  async loginPhoneVerify(
    @Body() dto: LoginPhoneVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const auth = await this.identity.send<AuthResult>(IdentityPatterns.OTP_VERIFY, {
      channel: 'phone',
      destination: dto.phone,
      code: dto.code,
      client: clientInfo(req),
    });
    return this.respondWithSession(auth, res);
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
  @ApiOperation({
    summary: 'Exchange a code for a session (finishes signup). Returns the tokens and sets the session cookies.',
  })
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
    return this.respondWithSession(auth, res);
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

  /** Tokens go in the body (mobile, API clients) and in HttpOnly cookies (web). */
  private respondWithSession(auth: AuthResult, res: Response): AuthResponseDto {
    this.cookies.setSession(res, auth);
    return {
      accessToken: auth.accessToken,
      accessTokenExpiresIn: auth.accessTokenExpiresIn,
      refreshToken: auth.refreshToken,
      refreshTokenExpiresAt: auth.refreshTokenExpiresAt,
      user: auth.user,
    };
  }
}

function clientInfo(req: Request): ClientInfo {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
