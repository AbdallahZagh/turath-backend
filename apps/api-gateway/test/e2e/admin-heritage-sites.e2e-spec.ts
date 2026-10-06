import { AdminHeritageSitePatterns, IdentityError } from '@turath/contracts';
import { makeImage, TEST_ADMIN_API_KEY } from '@turath/testing';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

// ConfigModule reads the environment when the module file is imported, so this must run before the imports.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.SUPABASE_BUCKET = 'heritage-sites';
});

let gw: GatewayHarness;
let supabase: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  [PNG, JPEG] = [
    await makeImage({ width: 400, height: 300 }),
    await makeImage({ width: 400, height: 300, format: 'jpeg' }),
  ];
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(async () => {
  await gw.reset();
  // A fake Supabase: it answers its own URLs, and everything else (supertest) goes to the real fetch.
  supabase = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', (url: string | URL, init?: RequestInit) =>
    String(url).startsWith('https://abc.supabase.co') ? supabase(String(url), init) : realFetch(url, init),
  );
});
afterEach(() => vi.unstubAllGlobals());

const KEY = { 'x-api-key': TEST_ADMIN_API_KEY };
const id = '55555555-5555-4555-8555-555555555555';
let PNG: Buffer;
let JPEG: Buffer;
const MB = 1024 * 1024;
const objectUploads = () =>
  supabase.mock.calls.filter(([url, init]) => /\/object\/heritage-sites\//.test(url) && init?.method === 'POST');

const site = {
  name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
  narrative: { en: 'One of the oldest mosques.', ar: 'من أقدم الجوامع.' },
  governorate: 'damascus',
  imageSrc: 'https://abc.supabase.co/storage/v1/object/public/heritage-sites/cover/2026-10/a.png',
  opensAt: '08:00',
  closesAt: '18:00',
  entryFeeSyp: 0,
  latitude: 33.5116,
  longitude: 36.3067,
  published: true,
};
const stored = { id, slug: 'umayyad-mosque', ...site, gallery: [] };

describe('the admin key', () => {
  it.each([
    ['GET', '/api/v1/admin/heritage-sites'],
    ['GET', `/api/v1/admin/heritage-sites/${id}`],
    ['POST', '/api/v1/admin/heritage-sites'],
    ['PUT', `/api/v1/admin/heritage-sites/${id}`],
    ['DELETE', `/api/v1/admin/heritage-sites/${id}`],
    ['POST', '/api/v1/admin/heritage-sites/images/cover'],
    ['POST', '/api/v1/admin/heritage-sites/images/gallery'],
  ])('guards %s %s: 404 without a key, and nothing is stored or asked', async (method, url) => {
    const res = await gw.http()[method.toLowerCase() as 'get'](url).send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
    expect(supabase).not.toHaveBeenCalled();
  });
});

describe('cover image upload', () => {
  const upload = (file?: { data: Buffer; name?: string; type?: string }) => {
    const req = gw.http().post('/api/v1/admin/heritage-sites/images/cover').set(KEY);
    return file
      ? req.attach('file', file.data, { filename: file.name ?? 'cover.png', contentType: file.type ?? 'image/png' })
      : req;
  };

  it('stores the image in the bucket and returns its public link', async () => {
    const res = await upload({ data: PNG });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      url: expect.stringMatching(
        /^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/heritage-sites\/cover\/\d{4}-\d{2}\/[0-9a-f-]{36}.webp$/,
      ),
      path: expect.stringMatching(/^cover\/\d{4}-\d{2}\/[0-9a-f-]{36}.webp$/),
      contentType: 'image/webp',
      size: expect.any(Number),
      originalSize: PNG.length,
      width: 400,
      height: 300,
    });
    expect(res.body.size).toBeLessThan(PNG.length / 4);
    const [target, init] = objectUploads()[0] as [string, RequestInit];
    expect(target).toContain(`/storage/v1/object/heritage-sites/${res.body.path}`);
    expect(init.headers).toMatchObject({ authorization: 'Bearer service-key', 'content-type': 'image/webp' });
    expect((init.body as Uint8Array).length).toBe(res.body.size);
  });

  it('trusts what the file is, not its name or declared type', async () => {
    const ok = await upload({ data: JPEG, name: 'photo.png', type: 'image/png' });
    const svg = await upload({
      data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      name: 'cover.png',
      type: 'image/png',
    });

    expect(ok.body.contentType).toBe('image/webp');
    expect(svg.status).toBe(415);
    expect(svg.body.code).toBe('IMAGE_TYPE_UNSUPPORTED');
  });

  it('accepts exactly 5 MB (and compresses it) and refuses more, naming the limit in the language asked for', async () => {
    const atLimit = await upload({ data: Buffer.concat([PNG, Buffer.alloc(5 * MB - PNG.length)]) });
    const over = await upload({ data: Buffer.concat([PNG, Buffer.alloc(5 * MB)]) });
    const overAr = await gw
      .http()
      .post('/api/v1/admin/heritage-sites/images/cover?lang=ar')
      .set(KEY)
      .attach('file', Buffer.concat([PNG, Buffer.alloc(5 * MB)]), { filename: 'c.png', contentType: 'image/png' });

    expect(atLimit.status).toBe(201);
    expect(atLimit.body.originalSize).toBe(5 * MB);
    expect(atLimit.body.size).toBeLessThan(MB / 8); // 5 MB in, a few dozen KB out
    expect(over.status).toBe(413);
    expect(over.body).toMatchObject({
      code: 'IMAGE_TOO_LARGE',
      message: 'The image is larger than 5 MB. Choose a smaller one.',
    });
    expect(overAr.status).toBe(413);
    expect(overAr.body.message).toContain('5');
    expect(overAr.body.message).toMatch(/[؀-ۿ]/);
    expect(objectUploads()).toHaveLength(1);
  });

  it('wants exactly one image', async () => {
    const none = await upload();
    const two = await gw
      .http()
      .post('/api/v1/admin/heritage-sites/images/cover')
      .set(KEY)
      .attach('file', PNG, 'a.png')
      .attach('file', PNG, 'b.png');
    const wrongField = await gw
      .http()
      .post('/api/v1/admin/heritage-sites/images/cover')
      .set(KEY)
      .attach('photo', PNG, 'a.png');

    expect(none.body.code).toBe('IMAGE_REQUIRED');
    expect([none.status, two.status, wrongField.status]).toEqual([400, 400, 400]);
    expect(two.body.code).toBe('TOO_MANY_IMAGES');
    expect(wrongField.body.code).toBe('TOO_MANY_IMAGES');
    expect(objectUploads()).toEqual([]);
  });

  it('reports a failing storage as 502 and a refused bucket the same way', async () => {
    supabase.mockResolvedValue(new Response('denied', { status: 403 }));

    const res = await upload({ data: PNG });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('STORAGE_UPLOAD_FAILED');
  });
});

describe('gallery image upload', () => {
  const upload = (files: { data: Buffer; name: string }[]) => {
    const req = gw.http().post('/api/v1/admin/heritage-sites/images/gallery').set(KEY);
    for (const file of files) req.attach('files', file.data, file.name);
    return req;
  };

  it('stores several images and returns them in order', async () => {
    const res = await upload([
      { data: PNG, name: 'a.png' },
      { data: JPEG, name: 'b.jpg' },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.map((image: { contentType: string }) => image.contentType)).toEqual(['image/webp', 'image/webp']);
    expect(res.body[0].path.startsWith('gallery/')).toBe(true);
    expect(objectUploads()).toHaveLength(2);
  });

  it('takes at most 10 files at once', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ data: PNG, name: `${i}.png` }));

    expect((await upload(ten)).status).toBe(201);
    const eleven = await upload([...ten, { data: PNG, name: 'x.png' }]);

    expect(eleven.status).toBe(400);
    expect(eleven.body.code).toBe('TOO_MANY_IMAGES');
    expect(eleven.body.message).toContain('10');
  });

  it('stores nothing when one of the files is not an image', async () => {
    const res = await upload([
      { data: PNG, name: 'a.png' },
      { data: Buffer.from('plain text'), name: 'b.png' },
    ]);

    expect(res.status).toBe(415);
    expect(objectUploads()).toEqual([]);
  });

  it('refuses a file over 5 MB', async () => {
    const res = await upload([{ data: Buffer.concat([PNG, Buffer.alloc(5 * MB)]), name: 'big.png' }]);

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('IMAGE_TOO_LARGE');
  });

  it('needs at least one file', async () => {
    const res = await gw.http().post('/api/v1/admin/heritage-sites/images/gallery').set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IMAGE_REQUIRED');
  });
});

describe('the sites', () => {
  const sent = (pattern: string) => gw.identity.lastPayload(pattern);

  it('lists with filters, passing them on and dropping an empty search', async () => {
    gw.identity.reply(AdminHeritageSitePatterns.LIST, () => ({
      items: [stored],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    }));

    const res = await gw
      .http()
      .get('/api/v1/admin/heritage-sites?governorate=damascus&status=published&search=%20&page=1')
      .set(KEY);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([stored]);
    expect(sent(AdminHeritageSitePatterns.LIST)).toEqual({
      page: 1,
      limit: 20,
      governorate: 'damascus',
      status: 'published',
      search: undefined,
    });
  });

  it('explains a bad filter in the language asked for', async () => {
    const res = await gw.http().get('/api/v1/admin/heritage-sites?status=hidden&lang=ar').set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([{ field: 'status', messages: ['اختر منشور أو مسودة.'] }]);
  });

  it('gets one, or 404 HERITAGE_SITE_NOT_FOUND, and a malformed id is a 400', async () => {
    gw.identity.reply(AdminHeritageSitePatterns.GET, () => stored);
    expect((await gw.http().get(`/api/v1/admin/heritage-sites/${id}`).set(KEY)).body).toEqual(stored);

    gw.identity.fail(AdminHeritageSitePatterns.GET, IdentityError.HERITAGE_SITE_NOT_FOUND);
    const missing = await gw.http().get(`/api/v1/admin/heritage-sites/${id}?lang=ar`).set(KEY);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'HERITAGE_SITE_NOT_FOUND', message: 'الموقع التراثي غير موجود.' });

    expect((await gw.http().get('/api/v1/admin/heritage-sites/not-a-uuid').set(KEY)).status).toBe(400);
  });

  it('adds a site: trims names, passes the body on and answers 201', async () => {
    gw.identity.reply(AdminHeritageSitePatterns.CREATE, () => stored);

    const res = await gw
      .http()
      .post('/api/v1/admin/heritage-sites')
      .set(KEY)
      .send({
        ...site,
        name: { en: '  Umayyad Mosque ', ar: 'الجامع الأموي' },
        gallery: [site.imageSrc.replace('/a.png', '/b.png')],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(stored);
    expect(sent(AdminHeritageSitePatterns.CREATE)).toMatchObject({
      input: { name: { en: 'Umayyad Mosque' }, gallery: [expect.stringContaining('/b.png')] },
    });
  });

  it('refuses a bad site with one translated message per field, and never reaches the service', async () => {
    const res = await gw
      .http()
      .post('/api/v1/admin/heritage-sites?lang=ar')
      .set(KEY)
      .send({
        ...site,
        imageSrc: 'http://insecure.example/a.png',
        gallery: Array.from({ length: 13 }, (_, i) => `https://x.com/${i}.png`),
        latitude: 120,
        opensAt: '8am',
        name: { en: 'x', ar: 'الجامع' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      ['gallery', 'imageSrc', 'latitude', 'name.en', 'opensAt'].sort(),
    );
    expect(res.body.errors.find((e: { field: string }) => e.field === 'imageSrc').messages[0]).toMatch(/[؀-ۿ]/);
    expect(gw.identity.sent).toEqual([]);
  });

  it('saves a site: the gallery is required, and the id is checked', async () => {
    gw.identity.reply(AdminHeritageSitePatterns.UPDATE, () => stored);

    const without = await gw.http().put(`/api/v1/admin/heritage-sites/${id}`).set(KEY).send(site);
    const withGallery = await gw
      .http()
      .put(`/api/v1/admin/heritage-sites/${id}`)
      .set(KEY)
      .send({ ...site, gallery: [] });
    const badId = await gw
      .http()
      .put('/api/v1/admin/heritage-sites/nope')
      .set(KEY)
      .send({ ...site, gallery: [] });

    expect(without.status).toBe(400);
    expect(without.body.errors).toEqual([{ field: 'gallery', messages: ['This field is required.'] }]);
    expect(withGallery.status).toBe(200);
    expect(sent(AdminHeritageSitePatterns.UPDATE)).toMatchObject({ id, input: { gallery: [] } });
    expect(badId.status).toBe(400);
  });

  it('deletes with 204, and a missing site is 404', async () => {
    gw.identity.reply(AdminHeritageSitePatterns.DELETE, () => ({ id }));
    const ok = await gw.http().delete(`/api/v1/admin/heritage-sites/${id}`).set(KEY);
    expect(ok.status).toBe(204);
    expect(ok.text).toBe('');

    gw.identity.fail(AdminHeritageSitePatterns.DELETE, IdentityError.HERITAGE_SITE_NOT_FOUND);
    expect((await gw.http().delete(`/api/v1/admin/heritage-sites/${id}`).set(KEY)).status).toBe(404);
  });
});
