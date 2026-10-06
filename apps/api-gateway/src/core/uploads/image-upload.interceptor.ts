import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AppException } from '@turath/common';
import { StorageError } from '@turath/contracts';

const TOO_MANY_FILES = /^(unexpected|too many)/i;

export type ImageUploadOptions = {
  /** Name of the multipart field the file(s) come in. */
  field: string;
  /** Most files in one request; `1` reads a single `file`. */
  maxFiles: number;
  /** Largest size of one file, in bytes. */
  maxBytes: number;
};

/**
 * Reads the multipart upload into memory with a hard size cap per file, and turns what multer
 * throws (file too big, too many files) into translated domain errors.
 */
export function ImageUploadInterceptor({ field, maxFiles, maxBytes }: ImageUploadOptions): Type<NestInterceptor> {
  const Reader = (
    maxFiles === 1
      ? FileInterceptor(field, { limits: { fileSize: maxBytes, files: 1 } })
      : FilesInterceptor(field, maxFiles, { limits: { fileSize: maxBytes } })
  ) as Type<NestInterceptor>;

  @Injectable()
  class TranslatedImageUpload extends Reader {
    override async intercept(context: ExecutionContext, next: CallHandler) {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        if (error instanceof PayloadTooLargeException) {
          throw new AppException(StorageError.IMAGE_TOO_LARGE, { maxMb: maxBytes / 1024 / 1024 });
        }
        // multer reports a wrong field name or more files than allowed as "Unexpected ... field" / "Too many files" (the wording varies by version)
        if (error instanceof BadRequestException && TOO_MANY_FILES.test(error.message)) {
          throw new AppException(StorageError.TOO_MANY_IMAGES, { max: maxFiles });
        }
        throw error;
      }
    }
  }
  return TranslatedImageUpload;
}
