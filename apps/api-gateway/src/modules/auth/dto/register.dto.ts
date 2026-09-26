import { ApiProperty } from '@nestjs/swagger';
import {
  IsBirthDate,
  IsCountryCode,
  IsEmailAddress,
  IsOneOf,
  IsPersonName,
  IsPhoneFor,
  IsStrongPassword,
} from '@turath/common';
import { ACCOUNT_TYPES, PROVIDER_TYPES, type AccountType, type ProviderType } from '@turath/contracts';
import { IsProviderTypeForAccount } from '../auth.validators.js';

/** POST /auth/register */
export class RegisterDto {
  @ApiProperty({
    enum: ACCOUNT_TYPES,
    example: 'TOURIST',
    description: '`TOURIST` books experiences. `PROVIDER` offers them (account role becomes `PROVIDER_OWNER`).',
  })
  @IsOneOf(ACCOUNT_TYPES, 'validation.ACCOUNT_TYPE')
  accountType: AccountType;

  @ApiProperty({
    enum: PROVIDER_TYPES,
    nullable: true,
    required: false,
    example: 'HOTEL',
    description:
      'Required when `accountType` is `PROVIDER`; leave it out (or send null) for `TOURIST`. ' +
      'Dropdown options with translated labels: `GET /api/v1/meta` → `providerTypes`.',
  })
  @IsProviderTypeForAccount()
  providerType?: ProviderType | null;

  @ApiProperty({
    example: 'Rami Haddad',
    minLength: 2,
    maxLength: 100,
    description: 'Full name. Letters in any language; spaces, hyphens, apostrophes and dots are allowed.',
  })
  @IsPersonName()
  name: string;

  @ApiProperty({
    example: '1994-05-17',
    format: 'date',
    description: 'ISO date `YYYY-MM-DD`. Must be in the past and not before 1900-01-01.',
  })
  @IsBirthDate()
  dateOfBirth: string;

  @ApiProperty({ example: 'SY', description: 'Nationality as an ISO 3166-1 alpha-2 country code (case-insensitive).' })
  @IsCountryCode()
  nationality: string;

  @ApiProperty({
    example: 'SY',
    description: 'Country the phone number belongs to, ISO 3166-1 alpha-2. Used to read national-format numbers.',
  })
  @IsCountryCode()
  phoneCountry: string;

  @ApiProperty({
    example: '0944 123 456',
    description:
      'Mobile number in national (`0944 123 456`) or international (`+963944123456`) format; stored as E.164.',
  })
  @IsPhoneFor('phoneCountry')
  phone: string;

  @ApiProperty({ example: 'rami.haddad@example.com', maxLength: 150, description: 'Stored lower-case.' })
  @IsEmailAddress()
  email: string;

  @ApiProperty({
    example: 'Turath2026',
    minLength: 8,
    maxLength: 128,
    description: '8–128 characters with at least one letter and one number.',
  })
  @IsStrongPassword()
  password: string;
}
