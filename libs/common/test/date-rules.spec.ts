import { IsCalendarDate, IsNotBefore } from '@turath/common';
import { validateDto } from '@turath/testing';

class Range {
  @IsCalendarDate()
  startAt: string;

  @IsNotBefore('startAt')
  @IsCalendarDate()
  endAt: string;
}

describe('IsCalendarDate', () => {
  it('accepts real days', async () => {
    expect(await validateDto(Range, { startAt: '2026-02-28', endAt: '2026-03-01' })).toEqual({});
    expect(await validateDto(Range, { startAt: '2028-02-29', endAt: '2028-02-29' })).toEqual({});
  });

  it('refuses days that do not exist, other formats, times and non-text', async () => {
    for (const bad of [
      '2026-02-30',
      '2026-13-01',
      '2026/02/01',
      '01-02-2026',
      '2026-2-1',
      '2026-02-01T10:00:00Z',
      'soon',
    ]) {
      expect(await validateDto(Range, { startAt: bad, endAt: '2030-01-01' }), bad).toEqual({
        startAt: 'validation.DATE',
      });
    }
    expect(await validateDto(Range, { startAt: 20260201, endAt: '2030-01-01' })).toEqual({
      startAt: 'validation.STRING',
    });
  });

  it('is required', async () => {
    expect(await validateDto(Range, {})).toEqual({ startAt: 'validation.REQUIRED', endAt: 'validation.REQUIRED' });
  });
});

describe('IsNotBefore', () => {
  it('accepts the same day and later days', async () => {
    expect(await validateDto(Range, { startAt: '2026-09-01', endAt: '2026-09-01' })).toEqual({});
    expect(await validateDto(Range, { startAt: '2026-09-01', endAt: '2027-01-01' })).toEqual({});
  });

  it('refuses an earlier day', async () => {
    expect(await validateDto(Range, { startAt: '2026-09-02', endAt: '2026-09-01' })).toEqual({
      endAt: 'validation.DATE_RANGE',
    });
  });

  it('leaves it to the other field when that one is missing or not a date', async () => {
    expect(await validateDto(Range, { endAt: '2026-09-01' })).toEqual({ startAt: 'validation.REQUIRED' });
    expect(await validateDto(Range, { startAt: 'soon', endAt: '2026-09-01' })).toEqual({ startAt: 'validation.DATE' });
  });
});
