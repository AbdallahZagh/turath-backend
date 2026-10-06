import type { ConfigService } from '@nestjs/config';
import { StorageNotConfiguredError, StorageRequestError, SupabaseStorage } from '@turath/common';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
const READY = {
  SUPABASE_URL: 'https://abc.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_BUCKET: 'sites',
};
const PREFIX = 'https://abc.supabase.co/storage/v1/object/public/sites/';

const respond = (status: number, body = '') => new Response(body, { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('configuration', () => {
  it('is configured only with both a URL and a key', () => {
    expect(new SupabaseStorage(config(READY)).configured).toBe(true);
    expect(new SupabaseStorage(config({ ...READY, SUPABASE_URL: '' })).configured).toBe(false);
    expect(new SupabaseStorage(config({ ...READY, SUPABASE_SERVICE_ROLE_KEY: '' })).configured).toBe(false);
  });

  it('refuses to call Supabase when it is not configured', async () => {
    const storage = new SupabaseStorage(config({}));

    await expect(storage.upload('a.png', new Uint8Array(), 'image/png')).rejects.toBeInstanceOf(
      StorageNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('links', () => {
  const storage = new SupabaseStorage(config(READY));

  it('builds the public link of an object, encoding each part of the path', () => {
    expect(storage.publicUrl('cover/2026-10/a b.png')).toBe(`${PREFIX}cover/2026-10/a%20b.png`);
  });

  it('reads the object path back from our own links only', () => {
    expect(storage.pathFromPublicUrl(`${PREFIX}cover/2026-10/a%20b.png`)).toBe('cover/2026-10/a b.png');
    expect(storage.pathFromPublicUrl(`${PREFIX}cover/x.png?t=1`)).toBe('cover/x.png');
    expect(storage.pathFromPublicUrl('/images/landing/site-palmyra.png')).toBeNull();
    expect(storage.pathFromPublicUrl('https://elsewhere.com/storage/v1/object/public/sites/x.png')).toBeNull();
    expect(storage.pathFromPublicUrl(PREFIX)).toBeNull();
  });

  it('never matches a link when it is not configured', () => {
    expect(
      new SupabaseStorage(config({})).pathFromPublicUrl('/storage/v1/object/public/heritage-sites/x.png'),
    ).toBeNull();
  });
});

describe('upload', () => {
  it('posts the bytes with the service key, never overwriting, and returns the public link', async () => {
    fetchMock.mockResolvedValue(respond(200, '{"Key":"sites/cover/a.png"}'));
    const storage = new SupabaseStorage(config(READY));

    const url = await storage.upload('cover/a.png', Uint8Array.of(1, 2, 3), 'image/png');

    expect(url).toBe(`${PREFIX}cover/a.png`);
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('https://abc.supabase.co/storage/v1/object/sites/cover/a.png');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer service-key',
      apikey: 'service-key',
      'content-type': 'image/png',
      'x-upsert': 'false',
    });
  });

  it('reports a refusal with the status Supabase gave', async () => {
    fetchMock.mockResolvedValue(respond(403, 'denied'));

    await expect(
      new SupabaseStorage(config(READY)).upload('a.png', Uint8Array.of(1), 'image/png'),
    ).rejects.toMatchObject({
      constructor: StorageRequestError,
      status: 403,
    });
  });
});

describe('keys', () => {
  it('sends a new sb_secret_ key as apikey only, never as a Bearer token', async () => {
    fetchMock.mockResolvedValue(respond(200));

    await new SupabaseStorage(config({ ...READY, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' })).upload(
      'a.png',
      Uint8Array.of(1),
      'image/png',
    );

    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_abc');
    expect(headers).not.toHaveProperty('authorization');
  });
});

describe('ensureBucket', () => {
  const options = { maxBytes: 5_242_880, allowedTypes: ['image/png'] };

  it('creates a public bucket with the limits, once', async () => {
    fetchMock.mockResolvedValue(respond(200, '{}'));
    const storage = new SupabaseStorage(config(READY));

    await storage.ensureBucket(options);
    await storage.ensureBucket(options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('https://abc.supabase.co/storage/v1/bucket');
    expect(JSON.parse(String(init.body))).toEqual({
      id: 'sites',
      name: 'sites',
      public: true,
      file_size_limit: 5_242_880,
      allowed_mime_types: ['image/png'],
    });
  });

  it('accepts a bucket that already exists, however Supabase words it', async () => {
    fetchMock.mockResolvedValueOnce(respond(409, '{}'));
    await expect(new SupabaseStorage(config(READY)).ensureBucket(options)).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(
      respond(400, '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}'),
    );
    await expect(new SupabaseStorage(config(READY)).ensureBucket(options)).resolves.toBeUndefined();
  });

  it('tries again after a real failure', async () => {
    fetchMock.mockResolvedValueOnce(respond(500, 'boom')).mockResolvedValueOnce(respond(200, '{}'));
    const storage = new SupabaseStorage(config(READY));

    await expect(storage.ensureBucket(options)).rejects.toBeInstanceOf(StorageRequestError);
    await expect(storage.ensureBucket(options)).resolves.toBeUndefined();
  });
});

describe('remove', () => {
  it('deletes the given paths in one request', async () => {
    fetchMock.mockResolvedValue(respond(200, '[]'));

    await new SupabaseStorage(config(READY)).remove(['cover/a.png', 'gallery/b.png']);

    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('https://abc.supabase.co/storage/v1/object/sites');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ prefixes: ['cover/a.png', 'gallery/b.png'] });
  });

  it('does nothing without paths or without configuration, and never throws', async () => {
    await new SupabaseStorage(config(READY)).remove([]);
    await new SupabaseStorage(config({})).remove(['a.png']);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(new SupabaseStorage(config(READY)).remove(['a.png'])).resolves.toBeUndefined();
  });
});
