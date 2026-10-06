import { validateDto } from '@turath/testing';
import {
  ListPromotionsQueryDto,
  ListPromotionTargetsQueryDto,
  SaveFeaturedSlotsDto,
  SavePromotionDto,
} from '../../../../../src/modules/featured/dto/featured.dto.js';

const promotion = (overrides: Record<string, unknown> = {}) => ({
  title: { en: 'Citadel dusk walks', ar: 'مشاوير غروب القلعة' },
  kind: 'featured',
  slot: 'pillar_trips',
  target: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
  startAt: '2026-09-10',
  endAt: '2026-09-24',
  ...overrides,
});

const slotFlags = (overrides: Record<string, unknown> = {}) => ({
  heritage_spotlight: true,
  pillar_hotels: true,
  pillar_dining: false,
  pillar_trips: true,
  pillar_events: true,
  pillar_guides: true,
  home_campaign: true,
  persona_rail: true,
  ...overrides,
});

describe('ListPromotionsQueryDto', () => {
  it('allows no filters, and every filter together', async () => {
    expect(await validateDto(ListPromotionsQueryDto, {})).toEqual({});
    expect(
      await validateDto(ListPromotionsQueryDto, {
        page: '2',
        limit: '50',
        kind: 'campaign',
        slot: 'home_campaign',
        status: 'live',
        search: '  citadel ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed kind, slot and status values', async () => {
    expect(await validateDto(ListPromotionsQueryDto, { kind: 'banner' })).toEqual({
      kind: 'validation.PROMOTION_KIND',
    });
    expect(await validateDto(ListPromotionsQueryDto, { slot: 'hero' })).toEqual({ slot: 'validation.FEATURED_SLOT' });
    expect(await validateDto(ListPromotionsQueryDto, { status: 'expired' })).toEqual({
      status: 'validation.PROMOTION_STATUS',
    });
  });

  it('rejects bad paging, a long search and unknown parameters', async () => {
    expect(await validateDto(ListPromotionsQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListPromotionsQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
    expect(Object.keys(await validateDto(ListPromotionsQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});

describe('SavePromotionDto', () => {
  it('accepts a full promotion, and a campaign in its slot', async () => {
    expect(await validateDto(SavePromotionDto, promotion())).toEqual({});
    expect(await validateDto(SavePromotionDto, promotion({ kind: 'campaign', slot: 'home_campaign' }))).toEqual({});
  });

  it('accepts a one-day promotion', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ startAt: '2026-09-10', endAt: '2026-09-10' }))).toEqual({});
  });

  it('requires every field', async () => {
    const errors = await validateDto(SavePromotionDto, {});

    expect(Object.keys(errors).sort()).toEqual(['endAt', 'kind', 'slot', 'startAt', 'target', 'title']);
    expect(Object.values(errors).every((key) => key === 'validation.REQUIRED')).toBe(true);
  });

  it('needs both languages of the title and the target, trimmed, up to 150 characters', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ title: { en: 'Walks' } }))).toEqual({
      'title.ar': 'validation.REQUIRED',
    });
    expect(await validateDto(SavePromotionDto, promotion({ target: { en: '  ', ar: 'ا' } }))).toEqual({
      'target.en': 'validation.REQUIRED',
    });
    expect(await validateDto(SavePromotionDto, promotion({ title: { en: 'x'.repeat(151), ar: 'ا' } }))).toEqual({
      'title.en': 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SavePromotionDto, promotion({ title: 'Walks' }))).toEqual({ title: 'validation.OBJECT' });
  });

  it('only takes a slot and a kind from the lists', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ slot: 'hero' }))).toEqual({
      slot: 'validation.FEATURED_SLOT',
    });
    expect(await validateDto(SavePromotionDto, promotion({ kind: 'banner' }))).toEqual({
      kind: 'validation.PROMOTION_KIND',
    });
  });

  it('wants real days, in YYYY-MM-DD', async () => {
    for (const startAt of ['2026-02-30', '10/09/2026', '2026-9-1', '2026-09-10T00:00:00Z', 'soon']) {
      expect(await validateDto(SavePromotionDto, promotion({ startAt })), startAt).toEqual({
        startAt: 'validation.DATE',
      });
    }
    expect(await validateDto(SavePromotionDto, promotion({ endAt: 20260924 }))).toEqual({ endAt: 'validation.STRING' });
  });

  it('refuses an end day before the start day, and only reports it on the end day', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ startAt: '2026-09-25', endAt: '2026-09-24' }))).toEqual({
      endAt: 'validation.DATE_RANGE',
    });
    expect(await validateDto(SavePromotionDto, promotion({ startAt: 'soon', endAt: '2026-09-24' }))).toEqual({
      startAt: 'validation.DATE',
    });
  });

  it('rejects extra fields, also inside the title', async () => {
    expect(Object.keys(await validateDto(SavePromotionDto, promotion({ status: 'live' })))).toEqual(['status']);
    expect(
      Object.keys(await validateDto(SavePromotionDto, promotion({ title: { en: 'Walks', ar: 'مشاوير', fr: 'x' } }))),
    ).toEqual(['title.fr']);
  });
});

describe('SaveFeaturedSlotsDto', () => {
  it('accepts every switch', async () => {
    expect(await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: true, slots: slotFlags() })).toEqual({});
    expect(
      await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: false, slots: slotFlags({ persona_rail: false }) }),
    ).toEqual({});
  });

  it('requires the master switch and the slots', async () => {
    expect(await validateDto(SaveFeaturedSlotsDto, {})).toEqual({
      featuringEnabled: 'validation.REQUIRED',
      slots: 'validation.REQUIRED',
    });
  });

  it('requires every slot, naming the one that is missing', async () => {
    const { persona_rail: _gone, ...seven } = slotFlags();

    expect(await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: true, slots: seven })).toEqual({
      'slots.persona_rail': 'validation.REQUIRED',
    });
  });

  it('wants true or false, not text or numbers', async () => {
    expect(await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: 'yes', slots: slotFlags() })).toEqual({
      featuringEnabled: 'validation.BOOLEAN',
    });
    expect(
      await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: true, slots: slotFlags({ pillar_hotels: 1 }) }),
    ).toEqual({
      'slots.pillar_hotels': 'validation.BOOLEAN',
    });
  });

  it('rejects an unknown slot and extra fields', async () => {
    expect(
      Object.keys(
        await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: true, slots: slotFlags({ hero: true }) }),
      ),
    ).toEqual(['slots.hero']);
    expect(
      Object.keys(await validateDto(SaveFeaturedSlotsDto, { featuringEnabled: true, slots: slotFlags(), extra: 1 })),
    ).toEqual(['extra']);
  });
});

describe('SavePromotionDto link', () => {
  const site = { type: 'heritageSite', id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b' };

  it('is optional: left out, null, or any of the three types', async () => {
    expect(await validateDto(SavePromotionDto, promotion())).toEqual({});
    expect(await validateDto(SavePromotionDto, promotion({ link: null }))).toEqual({});
    expect(await validateDto(SavePromotionDto, promotion({ link: site }))).toEqual({});
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'provider', id: site.id } }))).toEqual({});
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'category', id: 'hotels' } }))).toEqual({});
  });

  it('only takes a type from the list, and needs an id', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'page', id: 'x' } }))).toEqual({
      'link.type': 'validation.PROMOTION_LINK_TYPE',
    });
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'provider' } }))).toEqual({
      'link.id': 'validation.REQUIRED',
    });
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'provider', id: '   ' } }))).toEqual({
      'link.id': 'validation.REQUIRED',
    });
    expect(await validateDto(SavePromotionDto, promotion({ link: {} }))).toEqual({
      'link.type': 'validation.REQUIRED',
      'link.id': 'validation.REQUIRED',
    });
  });

  it('limits the id to 64 characters and wants an object, not text', async () => {
    expect(await validateDto(SavePromotionDto, promotion({ link: { type: 'provider', id: 'x'.repeat(65) } }))).toEqual({
      'link.id': 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SavePromotionDto, promotion({ link: 'heritage' }))).toEqual({ link: 'validation.OBJECT' });
  });

  it('rejects extra fields inside the link', async () => {
    expect(Object.keys(await validateDto(SavePromotionDto, promotion({ link: { ...site, slug: 'x' } })))).toEqual([
      'link.slug',
    ]);
  });
});

describe('ListPromotionTargetsQueryDto', () => {
  it('allows no parameters, and all of them together', async () => {
    expect(await validateDto(ListPromotionTargetsQueryDto, {})).toEqual({});
    expect(
      await validateDto(ListPromotionTargetsQueryDto, {
        type: 'heritageSite',
        search: '  umayyad ',
        limit: '30',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed types, and limits the search and the limit', async () => {
    expect(await validateDto(ListPromotionTargetsQueryDto, { type: 'page' })).toEqual({
      type: 'validation.PROMOTION_LINK_TYPE',
    });
    expect(await validateDto(ListPromotionTargetsQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
    expect(await validateDto(ListPromotionTargetsQueryDto, { limit: '0' })).toEqual({ limit: 'validation.MIN_VALUE' });
    expect(await validateDto(ListPromotionTargetsQueryDto, { limit: '51' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListPromotionTargetsQueryDto, { limit: 'many' })).toEqual({ limit: 'validation.INTEGER' });
  });

  it('rejects unknown parameters', async () => {
    expect(Object.keys(await validateDto(ListPromotionTargetsQueryDto, { page: '1' }))).toEqual(['page']);
  });
});
