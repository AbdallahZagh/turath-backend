import { ApiProperty } from '@nestjs/swagger';
import { IsOneOf, IsOtpCode } from '@turath/common';
import { AUTH_CHANNELS, type AuthChannel } from '@turath/contracts';
import { IsDestination } from '../auth.validators.js';

/** POST /auth/otp/send (also the body of POST /auth/password/forgot) */
export class SendOtpDto {
  @ApiProperty({ enum: AUTH_CHANNELS, example: 'phone', description: 'Where the code goes: `phone` (SMS) or `email`.' })
  @IsOneOf(AUTH_CHANNELS, 'validation.CHANNEL')
  channel: AuthChannel;

  @ApiProperty({
    example: '0944 123 456',
    description:
      'For `phone`: the mobile number (national Syrian or international format). For `email`: the email address.',
  })
  @IsDestination()
  destination: string;
}

/** POST /auth/otp/verify */
export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code that was sent (or `devCode` while testing).' })
  @IsOtpCode()
  code: string;
}
