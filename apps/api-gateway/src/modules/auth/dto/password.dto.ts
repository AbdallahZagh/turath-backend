import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsStrongPassword, Required, trim } from '@turath/common';
import { SendOtpDto } from './otp.dto.js';

/** The reset code from /auth/password/forgot, pasted back as-is. Rules run in the order listed. */
const IsResetToken = () =>
  applyDecorators(
    Transform(trim),
    Required(),
    IsString({ message: msg('validation.STRING') }),
    MaxLength(200, { message: msg('validation.RESET_TOKEN') }),
  );

/** POST /auth/password/forgot */
export class ForgotPasswordDto extends SendOtpDto {}

/** POST /auth/password/reset */
export class ResetPasswordDto {
  @ApiProperty({
    example: 'Qm9vay1yZXNldC10b2tlbi1leGFtcGxlLTEyMzQ1Njc4OQ',
    maxLength: 200,
    description: 'The reset code from `POST /auth/password/forgot` (sent by SMS/email, or `devCode` while testing).',
  })
  @IsResetToken()
  token: string;

  @ApiProperty({
    example: 'NewTurath2026',
    minLength: 8,
    maxLength: 128,
    description: 'The new password: 8–128 characters with at least one letter and one number.',
  })
  @IsStrongPassword()
  password: string;
}
