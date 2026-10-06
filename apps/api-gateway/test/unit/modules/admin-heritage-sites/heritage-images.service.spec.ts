import { AppException, StorageNotConfiguredError, type SupabaseStorage } from '@turath/common';
import { HERITAGE_COVER_MAX_BYTES, HERITAGE_GALLERY_MAX_BYTES } from '@turath/contracts';
import { makeImage } from '@turath/testing';
import sharp from 'sharp';
import { HeritageImagesService } from '../../../../src/modules/admin-heritage-sites/heritage-images.service.js';

const file = (buffer: Buffer, size = buffer.length) => ({ buffer, size });

function fakeStorage(overrides: Partial<Record<keyof SupabaseStorage, unknown>> = {}) {
  const calls = { uploaded: [] as { path: string; body: Buffer; type: string }[], removed: [] as string[][] };
  const storage = {
    configured: true,
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    upload: vi.fn(async (path: string, body: Buffer, type: string) => {
      calls.uploaded.push({ path, body, type });
      return `https://abc.supabase.co/storage/v1/object/public/heritage-sites/${path}`;
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.removed.push(paths);
    }),
    ...overrides,
  };
  return { storage, calls, service: new HeritageImagesService(storage as unknown as SupabaseStorage) };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return (error as AppException).code;
  }
};

describe('HeritageImagesService.upload', () => {
  it('compresses to WebP, stores that under its kind, and reports both sizes and the dimensions', async () => {
    const { service, calls } = fakeStorage();
    const png = await makeImage({ width: 800, height: 600 });

    const [image] = await service.upload('cover', [file(png)], HERITAGE_COVER_MAX_BYTES);

    expect(image.contentType).toBe('image/webp');
    expect(image.path).toMatch(/^cover\/\d{4}-\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(image.url).toBe(`https://abc.supabase.co/storage/v1/object/public/heritage-sites/${image.path}`);
    expect(image).toMatchObject({ originalSize: png.length, width: 800, height: 600 });
    expect(image.size).toBeLessThan(png.length / 4);
    expect(calls.uploaded).toHaveLength(1);
    expect(calls.uploaded[0].type).toBe('image/webp');
    expect(calls.uploaded[0].body.length).toBe(image.size);
    expect((await sharp(calls.uploaded[0].body).metadata()).format).toBe('webp');
  });

  it('fits a cover inside 1920 px and a gallery photo inside 1600 px', async () => {
    const { service } = fakeStorage();
    const big = await makeImage({ width: 2400, height: 1200, format: 'jpeg' });

    const [cover] = await service.upload('cover', [file(big)], HERITAGE_COVER_MAX_BYTES);
    const [photo] = await service.upload('gallery', [file(big)], HERITAGE_GALLERY_MAX_BYTES);

    expect(cover).toMatchObject({ width: 1920, height: 960 });
    expect(photo).toMatchObject({ width: 1600, height: 800 });
  });

  it('never stores something bigger than what was sent', async () => {
    const { service } = fakeStorage();
    const tiny = await makeImage({ width: 2, height: 2 });

    const [image] = await service.upload('cover', [file(tiny)], HERITAGE_COVER_MAX_BYTES);

    expect(image.size).toBeLessThanOrEqual(tiny.length);
    expect(['image/webp', 'image/png']).toContain(image.contentType);
  });

  it('keeps the order of several gallery images', async () => {
    const { service } = fakeStorage();
    const [a, b] = [await makeImage({ width: 300, height: 200 }), await makeImage({ width: 500, height: 400 })];

    const images = await service.upload('gallery', [file(a), file(b)], HERITAGE_GALLERY_MAX_BYTES);

    expect(images.map((image) => image.width)).toEqual([300, 500]);
    expect(images[0].path.startsWith('gallery/')).toBe(true);
  });

  it('prepares the public bucket with the image limits first', async () => {
    const { service, storage } = fakeStorage();

    await service.upload('cover', [file(await makeImage({ width: 100, height: 100 }))], HERITAGE_COVER_MAX_BYTES);

    expect(storage.ensureBucket).toHaveBeenCalledWith({
      maxBytes: 5 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  });

  it('says so when uploads are not set up, before looking at the files', async () => {
    const { service, storage } = fakeStorage({ configured: false });

    expect(await codeOf(service.upload('cover', [file(await makeImage())], 1_000_000))).toBe('STORAGE_NOT_CONFIGURED');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('needs at least one file', async () => {
    const { service } = fakeStorage();

    expect(await codeOf(service.upload('cover', undefined, 1000))).toBe('IMAGE_REQUIRED');
    expect(await codeOf(service.upload('gallery', [], 1000))).toBe('IMAGE_REQUIRED');
  });

  it('refuses a file over the size limit, passing the limit to the message, and accepts one exactly at it', async () => {
    const { service } = fakeStorage();
    const png = await makeImage({ width: 100, height: 100 });

    try {
      await service.upload('cover', [file(png, HERITAGE_COVER_MAX_BYTES + 1)], HERITAGE_COVER_MAX_BYTES);
      expect.unreachable();
    } catch (error) {
      expect((error as AppException).code).toBe('IMAGE_TOO_LARGE');
      expect((error as AppException).args).toEqual({ maxMb: 5 });
    }
    await expect(
      service.upload('cover', [file(png, HERITAGE_COVER_MAX_BYTES)], HERITAGE_COVER_MAX_BYTES),
    ).resolves.toHaveLength(1);
  });

  it('refuses what is not a JPEG, PNG or WebP, whatever it claims to be', async () => {
    const { service } = fakeStorage();

    expect(await codeOf(service.upload('cover', [file(Buffer.from('<svg></svg>'))], 1000))).toBe(
      'IMAGE_TYPE_UNSUPPORTED',
    );
    expect(await codeOf(service.upload('cover', [file(Buffer.from('GIF89a......'))], 1000))).toBe(
      'IMAGE_TYPE_UNSUPPORTED',
    );
  });

  it('refuses a file that starts like an image but is damaged', async () => {
    const { service, storage } = fakeStorage();
    const png = await makeImage();

    expect(await codeOf(service.upload('cover', [file(png.subarray(0, 50))], HERITAGE_COVER_MAX_BYTES))).toBe(
      'IMAGE_UNREADABLE',
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('checks and compresses every file before storing any', async () => {
    const { service, storage } = fakeStorage();

    expect(
      await codeOf(
        service.upload('gallery', [file(await makeImage()), file(Buffer.from('nope'))], HERITAGE_GALLERY_MAX_BYTES),
      ),
    ).toBe('IMAGE_TYPE_UNSUPPORTED');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes what it already stored when a later file fails, and reports a storage failure', async () => {
    let count = 0;
    const { service, calls } = fakeStorage({
      upload: vi.fn(async (path: string) => {
        count += 1;
        if (count === 2) throw new Error('boom');
        return `https://x/${path}`;
      }),
    });
    const image = await makeImage({ width: 200, height: 100 });

    expect(await codeOf(service.upload('gallery', [file(image), file(image)], HERITAGE_GALLERY_MAX_BYTES))).toBe(
      'STORAGE_UPLOAD_FAILED',
    );
    expect(calls.removed).toHaveLength(1);
    expect(calls.removed[0]).toHaveLength(1);
  });

  it('reports a bucket that cannot be prepared', async () => {
    const { service } = fakeStorage({ ensureBucket: vi.fn().mockRejectedValue(new Error('nope')) });

    expect(await codeOf(service.upload('cover', [file(await makeImage({ width: 50, height: 50 }))], 1_000_000))).toBe(
      'STORAGE_UPLOAD_FAILED',
    );
  });

  it('maps a storage that turns out not to be configured', async () => {
    const { service } = fakeStorage({ ensureBucket: vi.fn().mockRejectedValue(new StorageNotConfiguredError()) });

    expect(await codeOf(service.upload('cover', [file(await makeImage({ width: 50, height: 50 }))], 1_000_000))).toBe(
      'STORAGE_NOT_CONFIGURED',
    );
  });
});
