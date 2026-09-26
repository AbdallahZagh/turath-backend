import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, THEMES, type Locale, type Theme } from '@turath/common';
import { PROVIDER_TYPES, USER_ROLES, type ProviderType, type UserRole, type UserView } from '@turath/contracts';

/** The user as returned by GET /auth/profile and inside every sign-in response. */
export class UserDto implements UserView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Rami Haddad' }) fullName: string;
  @ApiProperty({ nullable: true, type: String, example: 'rami.haddad@example.com' }) email: string | null;
  @ApiProperty({ example: '+963944123456', description: 'E.164' }) phone: string;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) phoneCountry: string | null;
  @ApiProperty({ nullable: true, type: String, example: '1994-05-17' }) dateOfBirth: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'SY' }) nationality: string | null;
  @ApiProperty({ enum: USER_ROLES, description: 'Tourists are `TOURIST`; provider signups are `PROVIDER_OWNER`.' })
  role: UserRole;
  @ApiProperty({ enum: PROVIDER_TYPES, nullable: true, description: 'Kind of business; null for tourists.' })
  providerType: ProviderType | null;
  @ApiProperty({ minimum: 0, maximum: 100, example: 100, description: 'Starts at 100; drops 30 per no-show.' })
  reliabilityScore: number;
  @ApiProperty({ enum: LOCALES, description: 'Saved interface language.' }) locale: Locale;
  @ApiProperty({ enum: THEMES, description: 'Saved theme.' }) theme: Theme;
  @ApiProperty({ description: 'The phone was confirmed with a code.' }) phoneVerified: boolean;
  @ApiProperty({ description: 'The email was confirmed with a code.' }) emailVerified: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
