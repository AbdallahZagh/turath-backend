import sharp from 'sharp';

type Format = 'png' | 'jpeg' | 'webp';

/**
 * A real, decodable picture for upload tests: a smooth colour gradient with a little noise, so
 * it looks like a photo (big as a PNG, much smaller once compressed). `alpha` makes the right half transparent.
 */
export async function makeImage({
  width = 800,
  height = 600,
  format = 'png',
  alpha = false,
  orientation,
}: { width?: number; height?: number; format?: Format; alpha?: boolean; orientation?: number } = {}): Promise<Buffer> {
  const channels = 4;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const noise = (x * 7 + y * 13) % 9;
      pixels[i] = Math.min(255, Math.round((x / width) * 255) + noise);
      pixels[i + 1] = Math.min(255, Math.round((y / height) * 255) + noise);
      pixels[i + 2] = 128 + noise;
      pixels[i + 3] = alpha && x >= width / 2 ? 0 : 255;
    }
  }
  let image = sharp(pixels, { raw: { width, height, channels } });
  if (orientation) image = image.withMetadata({ orientation });
  if (format === 'png') return image.png().toBuffer();
  if (format === 'jpeg') return image.flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer();
  return image.webp({ quality: 95 }).toBuffer();
}
