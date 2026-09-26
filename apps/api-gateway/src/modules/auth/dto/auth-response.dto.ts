import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUTH_CHANNELS, type AuthChannel, type OtpDispatch } from '@turath/contracts';
import { UserDto } from '../../profile/dto/user.dto.js';

/** Returned by every sign-in: email login, phone login step 2, OTP verify. */
export class AuthResponseDto {
  @ApiProperty({ description: 'Send as `Authorization: Bearer <accessToken>`.' }) accessToken: string;
  @ApiProperty({ example: 900, description: 'Seconds the access token stays valid.' }) accessTokenExpiresIn: number;
  @ApiProperty({ description: 'Long-lived token, returned with every sign-in (also set as an HttpOnly cookie).' })
  refreshToken: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt: string;
  @ApiProperty({ type: UserDto }) user: UserDto;
}

/** Returned when a code is sent: register, phone login step 1, OTP resend, forgot password. */
export class OtpDispatchDto implements OtpDispatch {
  @ApiProperty({ enum: AUTH_CHANNELS, description: 'Where the code was sent.' }) channel: AuthChannel;
  @ApiProperty({ example: '••• 456', description: 'Masked phone or email, safe to show on screen.' })
  destination: string;
  @ApiProperty({ example: 300, description: 'Seconds until the code expires.' }) expiresInSeconds: number;
  @ApiProperty({ example: 60, description: 'Seconds before another code can be requested.' }) resendInSeconds: number;
  @ApiPropertyOptional({
    example: '123456',
    description:
      'Temporary, development only (`OTP_DEV_ECHO=true`): the code itself, until SMS/email delivery is live.',
  })
  devCode?: string;
}
