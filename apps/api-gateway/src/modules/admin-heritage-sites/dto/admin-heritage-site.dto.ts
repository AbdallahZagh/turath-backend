import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { IsIntInRange, IsOneOf, IsText, Required, trim } from '@turath/common';
import {
  GOVERNORATES,
  HERITAGE_COVER_MAX_BYTES,
  HERITAGE_GALLERY_MAX_BYTES,
  HERITAGE_GALLERY_MAX_IMAGES,
  HERITAGE_IMAGE_TYPES,
  HERITAGE_IMAGE_URL_MAX_LENGTH,
  HERITAGE_SITE_STATUSES,
  type AdminHeritageSite,
  type AdminHeritageSitePage,
  type CreateHeritageSiteInput,
  type Governorate,
  type HeritageImageType,
  type HeritageSiteStatus,
  type UpdateHeritageSiteInput,
  type UploadedImage,
} from '@turath/contracts';
import { IsNestedObject } from '../../../core/dto/nested-object.js';
import { PageQueryDto } from '../../../core/dto/page-query.dto.js';
import { LocalizedNameDto } from '../../admin-users/dto/admin-user.dto.js';

/** An https link, or a path of the frontend such as `/images/landing/site-palmyra.png`. No spaces. */
const IMAGE_LINK = /^(https:\/\/[^\s/][^\s]*|\/(?!\/)[^\s]*)$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_FEE_SYP = 100_000_000;

const linkDoc = {
  maxLength: HERITAGE_IMAGE_URL_MAX_LENGTH,
  example: 'https://xyz.supabase.co/storage/v1/object/public/heritage-sites/cover/2026-10/6f1c.webp',
};

/** One image link: required, text, at most 500 characters, an https link or a path starting with `/`. */
function IsImageLink() {
  return applyDecorators(
    Required(),
    IsString({ message: msg('validation.STRING') }),
    MaxLength(HERITAGE_IMAGE_URL_MAX_LENGTH, { message: msg('validation.MAX_LENGTH') }),
    Matches(IMAGE_LINK, { message: msg('validation.IMAGE_URL') }),
  );
}

/**
 * The gallery: a list of image links, at most `HERITAGE_GALLERY_MAX_IMAGES`, no link twice. Every
 * link follows the same rules as the cover. (Rules run in the order listed.)
 */
function IsImageGallery() {
  return applyDecorators(
    IsArray({ message: msg('validation.LIST') }),
    ArrayMaxSize(HERITAGE_GALLERY_MAX_IMAGES, { message: msg('validation.MAX_ITEMS') }),
    ArrayUnique({ message: msg('validation.NO_DUPLICATES') }),
    IsString({ each: true, message: msg('validation.STRING') }),
    MaxLength(HERITAGE_IMAGE_URL_MAX_LENGTH, { each: true, message: msg('validation.MAX_LENGTH') }),
    Matches(IMAGE_LINK, { each: true, message: msg('validation.IMAGE_URL') }),
  );
}

/** `HH:mm`, 24 hours. */
function IsClockTime() {
  return applyDecorators(
    Required(),
    IsString({ message: msg('validation.STRING') }),
    Matches(TIME, { message: msg('validation.TIME') }),
  );
}

/** A number from `min` to `max`, decimals allowed. */
function IsDecimalInRange(min: number, max: number) {
  return applyDecorators(
    Required(),
    IsNumber({ allowNaN: false, allowInfinity: false }, { message: msg('validation.NUMBER') }),
    Min(min, { message: msg('validation.MIN_VALUE') }),
    Max(max, { message: msg('validation.MAX_VALUE') }),
  );
}

/** The site name in each language. */
export class HeritageNameDto {
  @ApiProperty({ example: 'Umayyad Mosque', minLength: 2, maxLength: 150 })
  @IsText({ min: 2, max: 150 })
  en: string;

  @ApiProperty({ example: 'الجامع الأموي', minLength: 2, maxLength: 150 })
  @IsText({ min: 2, max: 150 })
  ar: string;
}

/** The site description in each language. */
export class HeritageNarrativeDto {
  @ApiProperty({ example: 'One of the oldest congregational mosques still in use.', minLength: 1, maxLength: 2000 })
  @IsText({ max: 2000 })
  en: string;

  @ApiProperty({ example: 'من أقدم الجوامع التي ما زالت قائمة.', minLength: 1, maxLength: 2000 })
  @IsText({ max: 2000 })
  ar: string;
}

/** Everything a site is saved with except the gallery, which differs between create and update. */
class HeritageSiteBodyDto {
  @ApiProperty({ type: HeritageNameDto }) @IsNestedObject(HeritageNameDto) name: HeritageNameDto;

  @ApiProperty({ type: HeritageNarrativeDto }) @IsNestedObject(HeritageNarrativeDto) narrative: HeritageNarrativeDto;

  @ApiProperty({ enum: GOVERNORATES })
  @IsOneOf(GOVERNORATES, 'validation.GOVERNORATE')
  governorate: Governorate;

  @ApiProperty({
    ...linkDoc,
    description:
      'The cover image: exactly one link, an https link (an upload from `POST /admin/heritage-sites/images/cover`) or a path of the frontend such as `/images/landing/site-palmyra.png`.',
  })
  @IsImageLink()
  imageSrc: string;

  @ApiProperty({ example: '08:00', description: 'Opening time, `HH:mm` (24h).' }) @IsClockTime() opensAt: string;

  @ApiProperty({
    example: '18:00',
    description: 'Closing time, `HH:mm` (24h). Earlier than the opening time means it stays open past midnight.',
  })
  @IsClockTime()
  closesAt: string;

  @ApiProperty({
    example: 25000,
    minimum: 0,
    maximum: MAX_FEE_SYP,
    description: 'Entry fee in whole Syrian pounds; `0` is free.',
  })
  @IsIntInRange({ min: 0, max: MAX_FEE_SYP })
  entryFeeSyp: number;

  @ApiProperty({ example: 33.5116, minimum: -90, maximum: 90 }) @IsDecimalInRange(-90, 90) latitude: number;

  @ApiProperty({ example: 36.3067, minimum: -180, maximum: 180 }) @IsDecimalInRange(-180, 180) longitude: number;

  @ApiProperty({ description: '`false` keeps it a draft that only admins see.' })
  @IsBoolean({ message: msg('validation.BOOLEAN') })
  @Required()
  published: boolean;
}

/** `POST /admin/heritage-sites`. Same shape as `CreateAdminAttractionInput` in the frontend mock: `gallery` is optional. */
export class CreateHeritageSiteDto extends HeritageSiteBodyDto implements CreateHeritageSiteInput {
  @ApiPropertyOptional({
    type: [String],
    maxItems: HERITAGE_GALLERY_MAX_IMAGES,
    uniqueItems: true,
    description: `The gallery: up to ${HERITAGE_GALLERY_MAX_IMAGES} image links, each following the same rules as \`imageSrc\`, none repeated. Left out means no gallery.`,
  })
  @IsImageGallery()
  @IsOptional()
  gallery?: string[];
}

/** `PUT /admin/heritage-sites/{id}`. Same shape as `UpdateAdminAttractionInput`: `gallery` is required. */
export class UpdateHeritageSiteDto extends HeritageSiteBodyDto implements UpdateHeritageSiteInput {
  @ApiProperty({
    type: [String],
    maxItems: HERITAGE_GALLERY_MAX_IMAGES,
    uniqueItems: true,
    description: `The complete gallery after this save: up to ${HERITAGE_GALLERY_MAX_IMAGES} image links (send \`[]\` for none). Uploaded images left out of it are deleted from storage.`,
  })
  @IsImageGallery()
  @Required()
  gallery: string[];
}

/** One heritage site. Same shape as `AdminAttraction` in the frontend mock. */
export class AdminHeritageSiteDto implements AdminHeritageSite {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'umayyad-mosque', description: 'Made from the English name when created; never changes.' })
  slug: string;
  @ApiProperty({ type: LocalizedNameDto }) name: LocalizedNameDto;
  @ApiProperty({ type: LocalizedNameDto }) narrative: LocalizedNameDto;
  @ApiProperty({ enum: GOVERNORATES }) governorate: Governorate;
  @ApiProperty({ ...linkDoc, description: 'The cover image link.' }) imageSrc: string;
  @ApiProperty({ example: '08:00' }) opensAt: string;
  @ApiProperty({ example: '18:00' }) closesAt: string;
  @ApiProperty({ example: 25000 }) entryFeeSyp: number;
  @ApiProperty({ example: 33.5116 }) latitude: number;
  @ApiProperty({ example: 36.3067 }) longitude: number;
  @ApiProperty() published: boolean;
  @ApiProperty({ type: [String], description: 'Gallery image links in display order; `[]` when there are none.' })
  gallery: string[];
}

/** `GET /admin/heritage-sites`: one page of sites. */
export class AdminHeritageSitePageDto implements AdminHeritageSitePage {
  @ApiProperty({ type: [AdminHeritageSiteDto], description: 'The sites on this page, newest first.' })
  items: AdminHeritageSiteDto[];
  @ApiProperty({ example: 1, description: 'The page returned.' }) page: number;
  @ApiProperty({ example: 20, description: 'Rows per page asked for.' }) limit: number;
  @ApiProperty({ example: 24, description: 'Sites matching the filters, across all pages.' }) total: number;
  @ApiProperty({ example: 2, description: '`0` when nothing matches.' }) totalPages: number;
}

/** `GET /admin/heritage-sites?page=&limit=&governorate=&status=&search=`. Everything is optional. */
export class ListHeritageSitesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: GOVERNORATES, description: 'Only sites in this governorate.' })
  @IsOneOf(GOVERNORATES, 'validation.GOVERNORATE', { optional: true })
  governorate?: Governorate;

  @ApiPropertyOptional({ enum: HERITAGE_SITE_STATUSES, description: '`published` or `draft`.' })
  @IsOneOf(HERITAGE_SITE_STATUSES, 'validation.HERITAGE_STATUS', { optional: true })
  status?: HeritageSiteStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    example: 'citadel',
    description: 'Matches the name (English or Arabic) and the slug, ignoring case. Empty means no search.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  @MaxLength(100, { message: msg('validation.MAX_LENGTH') })
  search?: string;
}

/** What an image upload returns. */
export class UploadedImageDto implements UploadedImage {
  @ApiProperty({ example: linkDoc.example, description: 'The public link. Put it in `imageSrc` or `gallery`.' })
  url: string;
  @ApiProperty({ example: 'cover/2026-10/6f1c.webp', description: 'Where it is stored in the bucket.' }) path: string;
  @ApiProperty({ enum: HERITAGE_IMAGE_TYPES, description: 'What the file really is, from its first bytes.' })
  contentType: HeritageImageType;
  @ApiProperty({ example: 61440, description: 'Size in bytes of what is stored, after compression.' }) size: number;
  @ApiProperty({ example: 2411520, description: 'Size in bytes of the file that was sent.' }) originalSize: number;
  @ApiProperty({ example: 1920, description: 'Width in pixels of what is stored.' }) width: number;
  @ApiProperty({ example: 1280, description: 'Height in pixels of what is stored.' }) height: number;
}

/** The limits the docs quote. */
export const IMAGE_LIMITS = {
  coverMb: HERITAGE_COVER_MAX_BYTES / 1024 / 1024,
  galleryMb: HERITAGE_GALLERY_MAX_BYTES / 1024 / 1024,
} as const;
