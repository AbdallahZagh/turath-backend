import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { DEFAULT_LOCALE, isLocale } from '@turath/common';
import { IdentityPatterns, type AuthResult, type ClientInfo, type OtpDispatch } from '@turath/contracts';
import { AuthCookies } from '../../core/auth/auth-cookies.js';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { RateLimited } from '../../core/docs/api-docs.js';
import {
  ForgotPasswordDocs,
  LoginEmailDocs,
  LoginPhoneDocs,
  LoginPhoneVerifyDocs,
  RegisterDocs,
  ResetPasswordDocs,
  SendOtpDocs,
  VerifyOtpDocs,
} from './auth.docs.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginEmailDto, LoginPhoneDto, LoginPhoneVerifyDto } from './dto/login.dto.js';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/** Code-sending endpoints: 5 per minute per IP (identity also caps 3 per number per 15 min). */
const OTP_LIMIT = { default: { limit: 5, ttl: 60_000 } };
const LOGIN_LIMIT = { default: { limit: 10, ttl: 60_000 } };

/** Signing up, signing in and password reset. Everything here works without a session. */
@ApiTags('auth')
@RateLimited()
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly identity: IdentityClient,
    private readonly cookies: AuthCookies,
  ) {}

  @Throttle(OTP_LIMIT)
  @Post('register')
  @RegisterDocs()
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

  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/email')
  @LoginEmailDocs()
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

  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/phone')
  @LoginPhoneDocs()
  loginPhone(@Body() dto: LoginPhoneDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.OTP_SEND, { channel: 'phone', destination: dto.phone });
  }

  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login/phone/verify')
  @LoginPhoneVerifyDocs()
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

  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('otp/send')
  @SendOtpDocs()
  sendOtp(@Body() dto: SendOtpDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.OTP_SEND, { channel: dto.channel, destination: dto.destination });
  }

  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  @VerifyOtpDocs()
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

  @Throttle(OTP_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('password/forgot')
  @ForgotPasswordDocs()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OtpDispatch> {
    return this.identity.send(IdentityPatterns.PASSWORD_FORGOT, { channel: dto.channel, destination: dto.destination });
  }

  @Throttle(LOGIN_LIMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password/reset')
  @ResetPasswordDocs()
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.identity.send(IdentityPatterns.PASSWORD_RESET, { token: dto.token, password: dto.password });
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
