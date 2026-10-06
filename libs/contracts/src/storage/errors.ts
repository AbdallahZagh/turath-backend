import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '@turath/common';

/**
 * Errors of image uploads (the gateway talks to Supabase Storage directly).
 * Messages (EN / AR) live in i18n/{en,ar}/errors/storage.json.
 */
export const StorageError = defineErrors('storage', {
  IMAGE_REQUIRED: HttpStatus.BAD_REQUEST,
  TOO_MANY_IMAGES: HttpStatus.BAD_REQUEST,
  IMAGE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  IMAGE_TYPE_UNSUPPORTED: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  IMAGE_UNREADABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  STORAGE_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  STORAGE_UPLOAD_FAILED: HttpStatus.BAD_GATEWAY,
});
