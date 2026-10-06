import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsOneOf, IsText, trim } from '@turath/common';
import {
  TAXONOMY_DIRECTIONS,
  TAXONOMY_KINDS,
  TAXONOMY_NAME_MAX_LENGTH,
  TAXONOMY_SLUG_MAX_LENGTH,
  type AdminTaxonomyTerm,
  type SaveTaxonomyTermInput,
  type TaxonomyDirection,
  type TaxonomyKind,
} from '@turath/contracts';
import { IsNestedObject } from '../../../core/dto/nested-object.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** One entry of a list. Same shape as `AdminTaxonomyTerm` in the frontend mock. */
export class AdminTaxonomyTermDto implements AdminTaxonomyTerm {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TAXONOMY_KINDS, description: 'Which list it belongs to.' }) kind: TaxonomyKind;
  @ApiProperty({
    example: 'live-music',
    description: 'Lower-case letters and digits joined by dashes; unique within its list.',
  })
  slug: string;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({ example: 1, description: '1, 2, 3… within its list, with no gaps. Lists are returned in this order.' })
  sortOrder: number;
}

/** `GET /admin/lists?kind=`. */
export class ListTaxonomyQueryDto {
  @ApiPropertyOptional({
    enum: TAXONOMY_KINDS,
    description: 'Only this list. Without it, all three lists are returned.',
  })
  @IsOneOf(TAXONOMY_KINDS, 'validation.TAXONOMY_KIND', { optional: true })
  kind?: TaxonomyKind;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}

/** The name of a term in each language. */
export class TaxonomyNameDto {
  @ApiProperty({ example: 'Live music', minLength: 1, maxLength: TAXONOMY_NAME_MAX_LENGTH })
  @IsText({ max: TAXONOMY_NAME_MAX_LENGTH })
  en: string;

  @ApiProperty({ example: 'موسيقى حية', minLength: 1, maxLength: TAXONOMY_NAME_MAX_LENGTH })
  @IsText({ max: TAXONOMY_NAME_MAX_LENGTH })
  ar: string;
}

/** `POST /admin/lists` and `PUT /admin/lists/{id}`. Same shape as `SaveAdminTaxonomyTermInput` in the frontend mock. */
export class SaveTaxonomyTermDto implements SaveTaxonomyTermInput {
  @ApiProperty({
    enum: TAXONOMY_KINDS,
    description: 'The list. On update it must be the list the term is already in: a term never moves between lists.',
  })
  @IsOneOf(TAXONOMY_KINDS, 'validation.TAXONOMY_KIND')
  kind: TaxonomyKind;

  @ApiPropertyOptional({
    maxLength: TAXONOMY_SLUG_MAX_LENGTH,
    example: 'live-music',
    description:
      'Turned into a slug (lower-case letters and digits joined by dashes). Empty or left out: made from `name.en`.',
  })
  @MaxLength(TAXONOMY_SLUG_MAX_LENGTH, { message: msg('validation.MAX_LENGTH') })
  @IsString({ message: msg('validation.STRING') })
  @IsOptional()
  @Transform(trim)
  slug?: string;

  @ApiProperty({ type: TaxonomyNameDto }) @IsNestedObject(TaxonomyNameDto) name: TaxonomyNameDto;
}

/** `PATCH /admin/lists/{id}/move` */
export class MoveTaxonomyTermDto {
  @ApiProperty({ enum: TAXONOMY_DIRECTIONS, example: -1, description: '`-1` moves the term up, `1` moves it down.' })
  @IsOneOf(TAXONOMY_DIRECTIONS, 'validation.DIRECTION')
  direction: TaxonomyDirection;
}
