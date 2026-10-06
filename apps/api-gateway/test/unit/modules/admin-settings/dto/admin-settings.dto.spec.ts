import { validateDto } from '@turath/testing';
import { AdminSettingsDto } from '../../../../../src/modules/admin-settings/dto/admin-settings.dto.js';

const slots = {
  heritage_spotlight: true,
  pillar_hotels: true,
  pillar_dining: true,
  pillar_trips: true,
  pillar_events: true,
  pillar_guides: true,
  home_campaign: true,
  persona_rail: false,
};

const settings = (overrides: { credit?: object; reliability?: object; flags?: object } = {}) => ({
  creditCeilingsSyp: { new: 1_500_000, established: 5_000_000, enterprise: 15_000_000, ...overrides.credit },
  reliability: {
    vipAtOrAbove: 80,
    standardAtOrAbove: 50,
    restrictedAtOrAbove: 30,
    lockSuspended: true,
    ...overrides.reliability,
  },
  flags: { otpChannel: 'sms', featuringEnabled: true, featuredSlots: slots, webCheckIn: true, ...overrides.flags },
});

describe('AdminSettingsDto', () => {
  it('accepts a full page', async () => {
    expect(await validateDto(AdminSettingsDto, settings())).toEqual({});
    expect(
      await validateDto(AdminSettingsDto, settings({ flags: { otpChannel: 'whatsapp', featuringEnabled: false } })),
    ).toEqual({});
  });

  it('requires the three sections', async () => {
    expect(await validateDto(AdminSettingsDto, {})).toEqual({
      creditCeilingsSyp: 'validation.REQUIRED',
      reliability: 'validation.REQUIRED',
      flags: 'validation.REQUIRED',
    });
  });

  describe('credit ceilings', () => {
    it('are whole numbers from 1 to 1,000,000,000', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ credit: { new: 1, enterprise: 1_000_000_000 } }))).toEqual(
        {},
      );
      expect(await validateDto(AdminSettingsDto, settings({ credit: { new: 0 } }))).toEqual({
        'creditCeilingsSyp.new': 'validation.MIN_VALUE',
      });
      expect(await validateDto(AdminSettingsDto, settings({ credit: { established: -5 } }))).toEqual({
        'creditCeilingsSyp.established': 'validation.MIN_VALUE',
      });
      expect(await validateDto(AdminSettingsDto, settings({ credit: { enterprise: 1_000_000_001 } }))).toEqual({
        'creditCeilingsSyp.enterprise': 'validation.MAX_VALUE',
      });
      expect(await validateDto(AdminSettingsDto, settings({ credit: { new: 1500.5 } }))).toEqual({
        'creditCeilingsSyp.new': 'validation.INTEGER',
      });
      expect(await validateDto(AdminSettingsDto, settings({ credit: { new: 'lots' } }))).toEqual({
        'creditCeilingsSyp.new': 'validation.INTEGER',
      });
    });

    it('all three are required, naming the missing one', async () => {
      const { established: _gone, ...two } = settings().creditCeilingsSyp;

      expect(await validateDto(AdminSettingsDto, { ...settings(), creditCeilingsSyp: two })).toEqual({
        'creditCeilingsSyp.established': 'validation.REQUIRED',
      });
    });
  });

  describe('reliability', () => {
    it('cutoffs are whole numbers from 0 to 100', async () => {
      expect(
        await validateDto(
          AdminSettingsDto,
          settings({ reliability: { vipAtOrAbove: 100, standardAtOrAbove: 1, restrictedAtOrAbove: 0 } }),
        ),
      ).toEqual({});
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { vipAtOrAbove: 101 } }))).toEqual({
        'reliability.vipAtOrAbove': 'validation.MAX_VALUE',
      });
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { restrictedAtOrAbove: -1 } }))).toEqual({
        'reliability.restrictedAtOrAbove': 'validation.MIN_VALUE',
      });
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { standardAtOrAbove: 50.5 } }))).toEqual({
        'reliability.standardAtOrAbove': 'validation.INTEGER',
      });
    });

    it('must go down: VIP above standard above restricted, strictly', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { vipAtOrAbove: 50 } }))).toEqual({
        'reliability.vipAtOrAbove': 'validation.SCORE_ORDER',
      });
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { standardAtOrAbove: 30 } }))).toEqual({
        'reliability.standardAtOrAbove': 'validation.SCORE_ORDER',
      });
      expect(
        await validateDto(
          AdminSettingsDto,
          settings({ reliability: { vipAtOrAbove: 60, standardAtOrAbove: 70, restrictedAtOrAbove: 80 } }),
        ),
      ).toEqual({
        'reliability.vipAtOrAbove': 'validation.SCORE_ORDER',
        'reliability.standardAtOrAbove': 'validation.SCORE_ORDER',
      });
    });

    it('does not report the order for a cutoff that is not a valid number, only that cutoff', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { standardAtOrAbove: 'half' } }))).toEqual({
        'reliability.standardAtOrAbove': 'validation.INTEGER',
      });
    });

    it('wants lockSuspended to be true or false', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ reliability: { lockSuspended: 'yes' } }))).toEqual({
        'reliability.lockSuspended': 'validation.BOOLEAN',
      });
    });
  });

  describe('flags', () => {
    it('only takes sms or whatsapp as the OTP channel', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ flags: { otpChannel: 'email' } }))).toEqual({
        'flags.otpChannel': 'validation.OTP_CHANNEL',
      });
      expect(await validateDto(AdminSettingsDto, settings({ flags: { otpChannel: 'SMS' } }))).toEqual({
        'flags.otpChannel': 'validation.OTP_CHANNEL',
      });
    });

    it('wants every switch to be true or false', async () => {
      expect(await validateDto(AdminSettingsDto, settings({ flags: { webCheckIn: 'on' } }))).toEqual({
        'flags.webCheckIn': 'validation.BOOLEAN',
      });
      expect(await validateDto(AdminSettingsDto, settings({ flags: { featuringEnabled: 1 } }))).toEqual({
        'flags.featuringEnabled': 'validation.BOOLEAN',
      });
    });

    it('needs all eight slot switches, naming the one that is missing or wrong', async () => {
      const { pillar_trips: _gone, ...seven } = slots;

      expect(await validateDto(AdminSettingsDto, settings({ flags: { featuredSlots: seven } }))).toEqual({
        'flags.featuredSlots.pillar_trips': 'validation.REQUIRED',
      });
      expect(
        await validateDto(AdminSettingsDto, settings({ flags: { featuredSlots: { ...slots, home_campaign: 'yes' } } })),
      ).toEqual({
        'flags.featuredSlots.home_campaign': 'validation.BOOLEAN',
      });
    });
  });

  it('rejects extra fields at every level', async () => {
    expect(Object.keys(await validateDto(AdminSettingsDto, { ...settings(), theme: 'dark' }))).toEqual(['theme']);
    expect(Object.keys(await validateDto(AdminSettingsDto, settings({ reliability: { gold: 90 } })))).toEqual([
      'reliability.gold',
    ]);
    expect(
      Object.keys(
        await validateDto(AdminSettingsDto, settings({ flags: { featuredSlots: { ...slots, hero: true } } })),
      ),
    ).toEqual(['flags.featuredSlots.hero']);
  });
});
