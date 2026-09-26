import { ApiProperty } from '@nestjs/swagger';
import { IsCountryCode, IsEmailAddress, IsOtpCode, IsPasswordInput, IsPhoneFor } from '@turath/common';

/** POST /auth/login/email */
export class LoginEmailDto {
  @ApiProperty({
    example: 'rami.haddad@example.com',
    maxLength: 150,
    description: 'The email used at signup (case-insensitive).',
  })
  @IsEmailAddress()
  email: string;

  @ApiProperty({ example: 'Turath2026', maxLength: 128, description: 'The account password.' })
  @IsPasswordInput()
  password: string;
}

/** POST /auth/login/phone */
export class LoginPhoneDto {
  @ApiProperty({ example: 'SY', description: 'Country the phone number belongs to, ISO 3166-1 alpha-2.' })
  @IsCountryCode()
  phoneCountry: string;

  @ApiProperty({
    example: '0944 123 456',
    description: 'The number used at signup, in national (`0944 123 456`) or international (`+963944123456`) format.',
  })
  @IsPhoneFor('phoneCountry')
  phone: string;
}

/** POST /auth/login/phone/verify */
export class LoginPhoneVerifyDto extends LoginPhoneDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code sent by SMS (or `devCode` while testing).' })
  @IsOtpCode()
  code: string;
}
