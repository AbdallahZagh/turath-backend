import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOneOf, LOCALES, THEMES, type Locale, type Theme } from '@turath/common';

/** PUT /preferences — both fields optional; send only what changes. */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    enum: LOCALES,
    example: 'ar',
    description: 'Interface language. `ar` switches to right-to-left.',
  })
  @IsOneOf(LOCALES, 'validation.LOCALE', { optional: true })
  locale?: Locale;

  @ApiPropertyOptional({ enum: THEMES, example: 'dark', description: '`system` follows the device setting.' })
  @IsOneOf(THEMES, 'validation.THEME', { optional: true })
  theme?: Theme;
}

/** GET and PUT /preferences response. */
export class PreferencesDto {
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty({ enum: THEMES }) theme: Theme;
  @ApiProperty({ enum: ['ltr', 'rtl'], description: 'Text direction for `locale` (`rtl` for Arabic).' })
  dir: 'ltr' | 'rtl';
}
