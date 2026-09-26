import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  IdentityPatterns,
  type AuthResult,
  type LoginEmailPayload,
  type OtpDispatch,
  type OtpSendPayload,
  type OtpVerifyPayload,
  type PasswordForgotPayload,
  type PasswordResetPayload,
  type RegisterPayload,
} from '@turath/contracts';
import { AuthService } from './auth.service.js';

/**
 * RabbitMQ handlers for signup, sign-in and password reset.
 * Input is validated by the gateway before it gets here.
 */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AuthHandler {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(IdentityPatterns.REGISTER)
  register(@Payload() payload: RegisterPayload): Promise<OtpDispatch> {
    return this.auth.register(payload);
  }

  @MessagePattern(IdentityPatterns.LOGIN_EMAIL)
  loginEmail(@Payload() payload: LoginEmailPayload): Promise<AuthResult> {
    return this.auth.loginWithEmail(payload);
  }

  @MessagePattern(IdentityPatterns.OTP_SEND)
  sendOtp(@Payload() payload: OtpSendPayload): Promise<OtpDispatch> {
    return this.auth.sendOtp(payload);
  }

  @MessagePattern(IdentityPatterns.OTP_VERIFY)
  verifyOtp(@Payload() payload: OtpVerifyPayload): Promise<AuthResult> {
    return this.auth.verifyOtp(payload);
  }

  @MessagePattern(IdentityPatterns.PASSWORD_FORGOT)
  forgotPassword(@Payload() payload: PasswordForgotPayload): Promise<OtpDispatch> {
    return this.auth.forgotPassword(payload);
  }

  @MessagePattern(IdentityPatterns.PASSWORD_RESET)
  async resetPassword(@Payload() payload: PasswordResetPayload): Promise<{ ok: true }> {
    await this.auth.resetPassword(payload);
    return { ok: true };
  }
}
