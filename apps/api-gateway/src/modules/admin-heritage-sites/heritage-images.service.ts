import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  compressImage,
  detectImageType,
  imageExtension,
  type ImageType,
  StorageNotConfiguredError,
  SupabaseStorage,
  UnreadableImageError,
} from '@turath/common';
import {
  HERITAGE_COVER_MAX_BYTES,
  HERITAGE_COVER_MAX_DIMENSION,
  HERITAGE_GALLERY_MAX_DIMENSION,
  HERITAGE_IMAGE_MAX_PIXELS,
  HERITAGE_IMAGE_QUALITY,
  HERITAGE_IMAGE_TYPES,
  StorageError,
  type UploadedImage,
} from '@turath/contracts';

export type ImageKind = 'cover' | 'gallery';

type Upload = { buffer: Buffer; size: number };
type Prepared = { buffer: Buffer; type: ImageType; width: number; height: number; originalSize: number };

const MAX_DIMENSION: Record<ImageKind, number> = {
  cover: HERITAGE_COVER_MAX_DIMENSION,
  gallery: HERITAGE_GALLERY_MAX_DIMENSION,
};

/** Validates uploaded images (real type, size), compresses them and stores them in Supabase Storage. */
@Injectable()
export class HeritageImagesService {
  private readonly logger = new Logger(HeritageImagesService.name);

  constructor(private readonly storage: SupabaseStorage) {}

  /**
   * Stores every file or none: all are checked and compressed first, and if a later upload fails
   * the earlier ones are deleted again. `maxBytes` is the size cap of one file for this kind of image.
   */
  async upload(kind: ImageKind, files: Upload[] | undefined, maxBytes: number): Promise<UploadedImage[]> {
    if (!this.storage.configured) throw new AppException(StorageError.STORAGE_NOT_CONFIGURED);
    if (!files || files.length === 0) throw new AppException(StorageError.IMAGE_REQUIRED);

    const prepared: Prepared[] = [];
    for (const file of files) prepared.push(await this.prepare(kind, file, maxBytes));

    try {
      await this.storage.ensureBucket({
        maxBytes: Math.max(HERITAGE_COVER_MAX_BYTES, maxBytes),
        allowedTypes: HERITAGE_IMAGE_TYPES,
      });
    } catch (error) {
      throw this.failure(error);
    }

    const day = new Date().toISOString().slice(0, 7);
    const stored: UploadedImage[] = [];
    try {
      for (const image of prepared) {
        const path = `${kind}/${day}/${randomUUID()}.${imageExtension(image.type)}`;
        const url = await this.storage.upload(path, image.buffer, image.type);
        stored.push({
          url,
          path,
          contentType: image.type,
          size: image.buffer.length,
          originalSize: image.originalSize,
          width: image.width,
          height: image.height,
        });
      }
    } catch (error) {
      await this.storage.remove(stored.map((image) => image.path));
      throw this.failure(error);
    }
    return stored;
  }

  /**
   * The file must be small enough and really be a JPEG, PNG or WebP, whatever it is called. It is
   * then shrunk (see `compressImage`); the original is kept only when that would make it bigger.
   */
  private async prepare(kind: ImageKind, file: Upload, maxBytes: number): Promise<Prepared> {
    if (file.size > maxBytes) {
      throw new AppException(StorageError.IMAGE_TOO_LARGE, { maxMb: maxBytes / 1024 / 1024 });
    }
    const type = detectImageType(file.buffer);
    if (!type) throw new AppException(StorageError.IMAGE_TYPE_UNSUPPORTED);

    try {
      const compressed = await compressImage(file.buffer, {
        maxDimension: MAX_DIMENSION[kind],
        quality: HERITAGE_IMAGE_QUALITY,
        maxPixels: HERITAGE_IMAGE_MAX_PIXELS,
      });
      const { width, height } = compressed;
      return compressed.buffer.length < file.buffer.length
        ? { buffer: compressed.buffer, type: compressed.contentType, width, height, originalSize: file.size }
        : { buffer: file.buffer, type, width, height, originalSize: file.size };
    } catch (error) {
      if (error instanceof UnreadableImageError) throw new AppException(StorageError.IMAGE_UNREADABLE);
      throw error;
    }
  }

  private failure(error: unknown): AppException {
    if (error instanceof StorageNotConfiguredError) return new AppException(StorageError.STORAGE_NOT_CONFIGURED);
    this.logger.error(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`);
    return new AppException(StorageError.STORAGE_UPLOAD_FAILED);
  }
}
