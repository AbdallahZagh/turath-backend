import { ApiProperty } from '@nestjs/swagger';
import { IsGreaterThan, IsIntInRange, IsOneOf } from '@turath/common';
import { MAX_CREDIT_CEILING_SYP, OTP_CHANNELS, type AdminSettings, type OtpChannel } from '@turath/contracts';
import { IsNestedObject } from '../../../core/dto/nested-object.js';
import { IsSwitch } from '../../../core/dto/switch.js';
import { FeaturedSlotFlagsDto } from '../../featured/dto/featured.dto.js';

type CreditCeilings = AdminSettings['creditCeilingsSyp'];
type Reliability = AdminSettings['reliability'];
type Flags = AdminSettings['flags'];

const ceilingDoc = (example: number) => ({
  example,
  minimum: 1,
  maximum: MAX_CREDIT_CEILING_SYP,
  description: 'Most a business on this tier can owe the platform, in whole Syrian pounds.',
});

/** The credit ceiling of each tier. All three are required. */
export class CreditCeilingsDto implements CreditCeilings {
  @ApiProperty(ceilingDoc(1_500_000))
  @IsIntInRange({ min: 1, max: MAX_CREDIT_CEILING_SYP })
  new: number;

  @ApiProperty(ceilingDoc(5_000_000))
  @IsIntInRange({ min: 1, max: MAX_CREDIT_CEILING_SYP })
  established: number;

  @ApiProperty(ceilingDoc(15_000_000))
  @IsIntInRange({ min: 1, max: MAX_CREDIT_CEILING_SYP })
  enterprise: number;
}

/**
 * Guest reliability cutoffs. The scores must go down: VIP above standard above restricted
 * (checked after each is a whole number from 0 to 100).
 */
export class ReliabilityDto implements Reliability {
  @ApiProperty({
    example: 80,
    minimum: 0,
    maximum: 100,
    description: 'At or above this a guest counts as VIP. Above `standardAtOrAbove`.',
  })
  @IsGreaterThan('standardAtOrAbove', 'validation.SCORE_ORDER')
  @IsIntInRange({ min: 0, max: 100 })
  vipAtOrAbove: number;

  @ApiProperty({
    example: 50,
    minimum: 0,
    maximum: 100,
    description: 'At or above this (and below VIP) a guest is standard. Above `restrictedAtOrAbove`.',
  })
  @IsGreaterThan('restrictedAtOrAbove', 'validation.SCORE_ORDER')
  @IsIntInRange({ min: 0, max: 100 })
  standardAtOrAbove: number;

  @ApiProperty({
    example: 30,
    minimum: 0,
    maximum: 100,
    description: 'At or above this (and below standard) a guest is restricted; below it they are suspended.',
  })
  @IsIntInRange({ min: 0, max: 100 })
  restrictedAtOrAbove: number;

  @ApiProperty({ description: 'Whether guests below the restricted cutoff are locked out.' })
  @IsSwitch()
  lockSuspended: boolean;
}

/** The switches. */
export class SettingsFlagsDto implements Flags {
  @ApiProperty({ enum: OTP_CHANNELS, description: 'How one-time codes are delivered to phones.' })
  @IsOneOf(OTP_CHANNELS, 'validation.OTP_CHANNEL')
  otpChannel: OtpChannel;

  @ApiProperty({ description: 'Master switch for home page featuring.' })
  @IsSwitch()
  featuringEnabled: boolean;

  @ApiProperty({
    type: FeaturedSlotFlagsDto,
    description: 'The switch of each of the eight home page slots. All eight are required.',
  })
  @IsNestedObject(FeaturedSlotFlagsDto)
  featuredSlots: FeaturedSlotFlagsDto;

  @ApiProperty() @IsSwitch() webCheckIn: boolean;
}

/** The settings page: what `GET /admin/settings` returns and `PUT /admin/settings` takes. Same shape as `AdminSettings` in the frontend mock. */
export class AdminSettingsDto implements AdminSettings {
  @ApiProperty({ type: CreditCeilingsDto, description: 'Credit ceiling of each tier.' })
  @IsNestedObject(CreditCeilingsDto)
  creditCeilingsSyp: CreditCeilingsDto;

  @ApiProperty({ type: ReliabilityDto }) @IsNestedObject(ReliabilityDto) reliability: ReliabilityDto;

  @ApiProperty({ type: SettingsFlagsDto }) @IsNestedObject(SettingsFlagsDto) flags: SettingsFlagsDto;
}
