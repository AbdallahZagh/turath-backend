import sharp from 'sharp';

/** The file could not be decoded as an image (damaged, or too many pixels). */
export class UnreadableImageError extends Error {
  constructor(cause: unknown) {
    super(`The image could not be read: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export type CompressOptions = {
  /** Longest side after resizing, in pixels. Smaller images are never enlarged. */
  maxDimension: number;
  /** WebP quality, 1-100. */
  quality: number;
  /** Largest picture accepted before decoding, in pixels (width x height): protects memory from decompression bombs. */
  maxPixels: number;
};

export type CompressedImage = {
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
};

/**
 * Shrinks an uploaded image as far as is sensible: turned upright by its EXIF orientation, fitted
 * inside `maxDimension` x `maxDimension` (never enlarged), every piece of metadata (EXIF, GPS,
 * colour profile, thumbnails) removed, and re-encoded as WebP at the slowest, smallest setting.
 * Transparency is kept. An animated image becomes its first frame.
 */
export async function compressImage(
  input: Uint8Array,
  { maxDimension, quality, maxPixels }: CompressOptions,
): Promise<CompressedImage> {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: maxPixels, failOn: 'error' })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, contentType: 'image/webp', width: info.width, height: info.height };
  } catch (error) {
    throw new UnreadableImageError(error);
  }
}
