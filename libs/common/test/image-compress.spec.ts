import { compressImage, UnreadableImageError } from '@turath/common';
import { makeImage } from '@turath/testing';
import sharp from 'sharp';

const options = { maxDimension: 1000, quality: 78, maxPixels: 40_000_000 };

describe('compressImage', () => {
  it('turns a photo-like PNG into a much smaller WebP', async () => {
    const png = await makeImage({ width: 800, height: 600, format: 'png' });

    const result = await compressImage(png, options);

    expect(result.contentType).toBe('image/webp');
    expect((await sharp(result.buffer).metadata()).format).toBe('webp');
    expect(result.buffer.length).toBeLessThan(png.length / 4);
  });

  it('also shrinks a JPEG', async () => {
    const jpeg = await makeImage({ format: 'jpeg' });

    expect((await compressImage(jpeg, options)).buffer.length).toBeLessThan(jpeg.length);
  });

  it('fits a big picture inside the longest side, keeping its proportions', async () => {
    const wide = await makeImage({ width: 2000, height: 1000 });
    const tall = await makeImage({ width: 1000, height: 2500 });

    expect(await compressImage(wide, options)).toMatchObject({ width: 1000, height: 500 });
    expect(await compressImage(tall, options)).toMatchObject({ width: 400, height: 1000 });
  });

  it('never enlarges a small picture', async () => {
    const small = await makeImage({ width: 120, height: 80 });

    expect(await compressImage(small, options)).toMatchObject({ width: 120, height: 80 });
  });

  it('keeps transparency', async () => {
    const result = await compressImage(await makeImage({ alpha: true }), options);
    const { data, info } = await sharp(result.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(data[3]).toBe(255); // top-left pixel: opaque
    expect(data[(info.width - 1) * info.channels + 3]).toBe(0); // top-right pixel: transparent
  });

  it('turns the picture upright from its EXIF orientation, and removes all metadata', async () => {
    // A landscape 600x300 stored with "rotate 90 degrees" is shown as portrait 300x600.
    const rotated = await makeImage({ width: 600, height: 300, format: 'jpeg', orientation: 6 });
    expect((await sharp(rotated).metadata()).orientation).toBe(6);

    const result = await compressImage(rotated, options);
    const meta = await sharp(result.buffer).metadata();

    expect(result).toMatchObject({ width: 300, height: 600 });
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it('refuses damaged data and anything that only starts like an image', async () => {
    const png = await makeImage();

    await expect(compressImage(Buffer.from('not an image at all'), options)).rejects.toBeInstanceOf(
      UnreadableImageError,
    );
    await expect(compressImage(png.subarray(0, 40), options)).rejects.toBeInstanceOf(UnreadableImageError);
    await expect(
      compressImage(Buffer.concat([png.subarray(0, 60), Buffer.alloc(200, 7)]), options),
    ).rejects.toBeInstanceOf(UnreadableImageError);
  });

  it('refuses a picture with more pixels than allowed, without decoding it', async () => {
    const png = await makeImage({ width: 400, height: 300 });

    await expect(compressImage(png, { ...options, maxPixels: 100_000 })).rejects.toBeInstanceOf(UnreadableImageError);
    await expect(compressImage(png, { ...options, maxPixels: 120_000 })).resolves.toBeDefined();
  });
});
