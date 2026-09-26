import { IdentityPatterns } from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { cookiesOf, createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

describe('GET /api/v1/meta', () => {
  it('returns translated signup dropdowns', async () => {
    const res = await gw.http().get('/api/v1/meta?lang=ar');

    expect(res.status).toBe(200);
    expect(res.body.accountTypes).toEqual([
      { code: 'TOURIST', label: 'سائح' },
      { code: 'PROVIDER', label: 'مزوّد خدمة' },
    ]);
    expect(res.body.providerTypes.map((option: { code: string }) => option.code)).toEqual([
      'RESTAURANT',
      'HOTEL',
      'TRIP_AGENCY',
      'EVENT_MANAGER',
      'TOUR_GUIDE',
    ]);
  });
});

describe('/api/v1/preferences', () => {
  it('sets the locale and theme cookies', async () => {
    const res = await gw.http().put('/api/v1/preferences').send({ locale: 'ar', theme: 'dark' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locale: 'ar', theme: 'dark', dir: 'rtl' });
    expect(cookiesOf(res)).toMatch(/locale=ar.*theme=dark|theme=dark.*locale=ar/);
  });

  it('saves the choice on the account when signed in', async () => {
    const { token, userId } = await gw.signIn();
    gw.identity.reply(IdentityPatterns.PREFERENCES_UPDATE, () => ({}));

    await gw.http().put('/api/v1/preferences').auth(token, { type: 'bearer' }).send({ theme: 'light' });

    expect(gw.identity.lastPayload(IdentityPatterns.PREFERENCES_UPDATE)).toEqual({ userId, theme: 'light' });
  });

  it('explains invalid values in plain words', async () => {
    const res = await gw.http().put('/api/v1/preferences').send({ locale: 'fr', theme: 'blue', color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'locale', messages: ['Choose English (en) or Arabic (ar).'] },
        { field: 'theme', messages: ['Choose light, dark or system.'] },
        { field: 'color', messages: ['This field is not allowed.'] },
      ]),
    );
  });
});

describe('hidden admin API', () => {
  it('answers 404 without a key, like an unknown route', async () => {
    const res = await gw.http().get('/api/v1/admin/admins');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('works with a configured key', async () => {
    gw.identity.reply('identity.admin.list', () => []);

    const res = await gw.http().get('/api/v1/admin/admins').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('validates input once the key is accepted', async () => {
    const res = await gw.http().post('/api/v1/admin/admins?lang=ar').set('x-api-key', TEST_ADMIN_API_KEY).send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(5);
  });
});

describe('Swagger', () => {
  it('documents every public route with an English and an Arabic description', async () => {
    const spec = (await gw.http().get('/api/docs-json')).body as {
      paths: Record<string, Record<string, { description?: string }>>;
    };

    const operations = Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.entries(ops).map(([method, op]) => ({
        route: `${method.toUpperCase()} ${path}`,
        description: op.description ?? '',
      })),
    );

    expect(operations.length).toBeGreaterThanOrEqual(16);
    for (const { route, description } of operations) {
      expect(description, route).not.toBe('');
      expect(description, route).toContain('dir="rtl"');
    }
  });

  it('keeps the admin and health routes out of the docs', async () => {
    const paths = Object.keys((await gw.http().get('/api/docs-json')).body.paths);

    expect(paths.some((path) => path.includes('admin') || path.includes('health'))).toBe(false);
  });
});
