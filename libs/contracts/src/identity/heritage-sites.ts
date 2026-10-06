import type { Page, PageQuery } from '@turath/common';
import type { Governorate } from './providers.js';

export const HERITAGE_SITE_STATUSES = ['published', 'draft'] as const;
export type HeritageSiteStatus = (typeof HERITAGE_SITE_STATUSES)[number];

/**
 * Image rules, enforced on upload (`POST /admin/heritage-sites/images/...`) and on the links a
 * site is saved with. A site has exactly one cover image and up to `HERITAGE_GALLERY_MAX_IMAGES`
 * gallery images.
 */
export const HERITAGE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type HeritageImageType = (typeof HERITAGE_IMAGE_TYPES)[number];
export const HERITAGE_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const HERITAGE_GALLERY_MAX_BYTES = 5 * 1024 * 1024;
export const HERITAGE_GALLERY_MAX_IMAGES = 12;
/**
 * Every upload is shrunk before it is stored: fitted inside this many pixels (cover / gallery),
 * metadata removed and re-encoded as WebP at this quality. A picture with more pixels than
 * `HERITAGE_IMAGE_MAX_PIXELS` is refused rather than decoded.
 */
export const HERITAGE_COVER_MAX_DIMENSION = 1920;
export const HERITAGE_GALLERY_MAX_DIMENSION = 1600;
export const HERITAGE_IMAGE_QUALITY = 78;
export const HERITAGE_IMAGE_MAX_PIXELS = 40_000_000;
/** Most files one gallery upload request can carry. */
export const HERITAGE_GALLERY_UPLOAD_MAX_FILES = 10;
/** Longest image link stored, in characters. */
export const HERITAGE_IMAGE_URL_MAX_LENGTH = 500;

type LocalizedText = { en: string; ar: string };

/** A heritage site. Same shape as `AdminAttraction` in the frontend's `lib/mock/adminAttractions.ts`. */
export type AdminHeritageSite = {
  id: string;
  /** Made from the English name when the site is created; never changes. */
  slug: string;
  name: LocalizedText;
  narrative: LocalizedText;
  governorate: Governorate;
  /** The cover image: an https link, or a path of the frontend such as `/images/landing/site-palmyra.png`. */
  imageSrc: string;
  /** `HH:mm` (24h). Closing before opening means it stays open past midnight. */
  opensAt: string;
  closesAt: string;
  /** Whole Syrian pounds; `0` is free. */
  entryFeeSyp: number;
  latitude: number;
  longitude: number;
  published: boolean;
  /** Extra photos in display order; `[]` when there are none. */
  gallery: string[];
};

/** `POST /admin/heritage-sites`. Same shape as `CreateAdminAttractionInput` in the frontend mock. */
export type CreateHeritageSiteInput = Omit<AdminHeritageSite, 'id' | 'slug' | 'gallery'> & { gallery?: string[] };

/** `PUT /admin/heritage-sites/{id}`. Same shape as `UpdateAdminAttractionInput`: everything is replaced, the slug is kept. */
export type UpdateHeritageSiteInput = Omit<AdminHeritageSite, 'id' | 'slug'>;

/** `GET /admin/heritage-sites` filters, on top of paging. Every filter is optional and they combine. */
export type AdminHeritageSiteListPayload = PageQuery & {
  governorate?: Governorate;
  status?: HeritageSiteStatus;
  /** Matches the name (either language) and the slug, ignoring case. */
  search?: string;
};

export type AdminHeritageSiteGetPayload = { id: string };
export type AdminHeritageSiteCreatePayload = { input: CreateHeritageSiteInput };
export type AdminHeritageSiteUpdatePayload = { id: string; input: UpdateHeritageSiteInput };
export type AdminHeritageSiteDeletePayload = { id: string };

export type AdminHeritageSitePage = Page<AdminHeritageSite>;

/** What an image upload returns: put `url` in `imageSrc` or `gallery`. */
export type UploadedImage = {
  /** The public link of the image. */
  url: string;
  /** Where it is stored in the bucket. */
  path: string;
  contentType: HeritageImageType;
  /** Size in bytes of what is stored, after compression. */
  size: number;
  /** Size in bytes of the file that was sent. */
  originalSize: number;
  /** Pixels of what is stored. */
  width: number;
  height: number;
};
