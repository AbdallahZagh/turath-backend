import {
  FEATURED_SLOT_CAPACITY,
  FEATURED_SLOT_IDS,
  kindForSlot,
  promotionStatus,
  slotRequiresCampaign,
} from '@turath/contracts';

describe('promotionStatus', () => {
  const run = { startAt: '2026-09-10', endAt: '2026-09-24' };

  it('is scheduled before the first day', () => {
    expect(promotionStatus(run, '2026-09-09')).toBe('scheduled');
    expect(promotionStatus(run, '2026-01-01')).toBe('scheduled');
  });

  it('is live from the first day to the last day, both included', () => {
    expect(promotionStatus(run, '2026-09-10')).toBe('live');
    expect(promotionStatus(run, '2026-09-17')).toBe('live');
    expect(promotionStatus(run, '2026-09-24')).toBe('live');
  });

  it('is ended after the last day', () => {
    expect(promotionStatus(run, '2026-09-25')).toBe('ended');
    expect(promotionStatus(run, '2027-01-01')).toBe('ended');
  });

  it('is live for the whole of a one-day promotion', () => {
    expect(promotionStatus({ startAt: '2026-09-10', endAt: '2026-09-10' }, '2026-09-10')).toBe('live');
  });
});

describe('slots', () => {
  it('has a capacity for every slot, and the capacities of the mock', () => {
    expect(Object.keys(FEATURED_SLOT_CAPACITY).sort()).toEqual([...FEATURED_SLOT_IDS].sort());
    expect(FEATURED_SLOT_CAPACITY).toMatchObject({
      heritage_spotlight: 6,
      persona_rail: 4,
      home_campaign: 1,
      pillar_hotels: 1,
    });
  });

  it('takes a campaign only in home_campaign', () => {
    expect(FEATURED_SLOT_IDS.filter(slotRequiresCampaign)).toEqual(['home_campaign']);
    expect(kindForSlot('home_campaign')).toBe('campaign');
    expect(kindForSlot('persona_rail')).toBe('featured');
  });
});
