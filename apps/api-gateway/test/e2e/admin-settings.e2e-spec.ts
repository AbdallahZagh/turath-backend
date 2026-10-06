import { AdminSettingsPatterns, FEATURED_SLOT_IDS } from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const KEY = { 'x-api-key': TEST_ADMIN_API_KEY };
const URL = '/api/v1/admin/settings';

const slots = Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, true]));
const settings = {
  creditCeilingsSyp: { new: 1_500_000, established: 5_000_000, enterprise: 15_000_000 },
  reliability: { vipAtOrAbove: 80, standardAtOrAbove: 50, restrictedAtOrAbove: 30, lockSuspended: true },
  flags: { otpChannel: 'sms', featuringEnabled: true, featuredSlots: slots, webCheckIn: true },
};
const sent = () => gw.identity.lastPayload(AdminSettingsPatterns.SAVE);

describe('the admin key', () => {
  it.each([['GET'], ['PUT']])('guards %s: 404 without a key, and the service is never asked', async (method) => {
    const res = await gw.http()[method.toLowerCase() as 'get'](URL).send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });
});

describe('GET /admin/settings', () => {
  it('returns the page as the service gave it', async () => {
    gw.identity.reply(AdminSettingsPatterns.GET, () => settings);

    const res = await gw.http().get(URL).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
  });
});

describe('PUT /admin/settings', () => {
  it('saves the whole page, passing it on as plain values', async () => {
    gw.identity.reply(AdminSettingsPatterns.SAVE, () => settings);

    const res = await gw.http().put(URL).set(KEY).send(settings);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
    expect(sent()).toEqual(settings);
  });

  it('refuses a page whose scores do not go down, naming the fields, in the language asked for', async () => {
    const res = await gw
      .http()
      .put(`${URL}?lang=ar`)
      .set(KEY)
      .send({ ...settings, reliability: { ...settings.reliability, vipAtOrAbove: 40 } });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([
      { field: 'reliability.vipAtOrAbove', messages: ['يجب أن تتناقص الدرجات: كبار العملاء فوق العادي فوق المقيَّد.'] },
    ]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('refuses a bad page with one message per field, and never reaches the service', async () => {
    const { persona_rail: _gone, ...seven } = slots;

    const res = await gw
      .http()
      .put(URL)
      .set(KEY)
      .send({
        creditCeilingsSyp: { ...settings.creditCeilingsSyp, new: 0 },
        reliability: { ...settings.reliability, lockSuspended: 'yes' },
        flags: { ...settings.flags, otpChannel: 'email', featuredSlots: seven },
        theme: 'dark',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      [
        'creditCeilingsSyp.new',
        'flags.featuredSlots.persona_rail',
        'flags.otpChannel',
        'reliability.lockSuspended',
        'theme',
      ].sort(),
    );
    expect(gw.identity.sent).toEqual([]);
  });

  it('needs every section', async () => {
    const res = await gw.http().put(URL).set(KEY).send({});

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual([
      'creditCeilingsSyp',
      'flags',
      'reliability',
    ]);
  });
});
