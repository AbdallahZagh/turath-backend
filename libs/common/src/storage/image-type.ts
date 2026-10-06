export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSIONS: Record<ImageType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const imageExtension = (type: ImageType): string => EXTENSIONS[type];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * What an uploaded file really is, from its first bytes. The `Content-Type` the browser sends
 * and the file name are chosen by the client, so neither is trusted.
 */
export function detectImageType(bytes: Uint8Array): ImageType | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp';
  return undefined;
}
