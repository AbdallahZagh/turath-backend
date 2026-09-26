import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, THEMES, type Locale, type Theme } from '@turath/common';

export class OptionDto {
  @ApiProperty({ example: 'HOTEL', description: 'Value to send to the API.' }) code: string;
  @ApiProperty({ example: 'Hotel', description: 'Label in the request language.' }) label: string;
}

export class LocaleOptionDto extends OptionDto {
  @ApiProperty({ enum: ['ltr', 'rtl'] }) dir: 'ltr' | 'rtl';
}

/** GET /meta */
export class MetaDto {
  @ApiProperty({ example: 'Turath' }) appName: string;
  @ApiProperty({ type: [LocaleOptionDto] }) locales: LocaleOptionDto[];
  @ApiProperty({ enum: LOCALES }) defaultLocale: Locale;
  @ApiProperty({ type: [OptionDto] }) themes: OptionDto[];
  @ApiProperty({ enum: THEMES }) defaultTheme: Theme;
  @ApiProperty({ type: [String], example: ['SYP', 'USD'] }) currencies: string[];
  @ApiProperty({ type: [OptionDto], description: 'Signup dropdown: Tourist / Provider.' }) accountTypes: OptionDto[];
  @ApiProperty({ type: [OptionDto], description: 'Signup dropdown for providers.' }) providerTypes: OptionDto[];
}
