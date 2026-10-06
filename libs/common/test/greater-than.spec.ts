import { IsOptional } from 'class-validator';
import { IsGreaterThan } from '@turath/common';
import { validateDto } from '@turath/testing';

class Scores {
  @IsGreaterThan('standard', 'validation.SCORE_ORDER')
  vip: unknown;

  @IsOptional()
  standard: unknown;
}

describe('IsGreaterThan', () => {
  it('accepts a larger number, and refuses an equal or smaller one', async () => {
    // only decorated fields are whitelisted, so the second field is declared with the same rule
    class Pair {
      @IsGreaterThan('low', 'validation.SCORE_ORDER')
      high: unknown;

      @IsGreaterThan('high', 'validation.SCORE_ORDER')
      low: unknown;
    }
    expect(await validateDto(Pair, { high: 5, low: 3 })).toEqual({ low: 'validation.SCORE_ORDER' });
    expect(await validateDto(Pair, { high: 5, low: 5 })).toEqual({
      high: 'validation.SCORE_ORDER',
      low: 'validation.SCORE_ORDER',
    });
    expect(await validateDto(Pair, { high: 3, low: 5 })).toEqual({ high: 'validation.SCORE_ORDER' });
  });

  it('says nothing when either value is not a number, leaving it to that field own rules', async () => {
    expect(await validateDto(Scores, { vip: 'high', standard: 3 })).toEqual({});
    expect(await validateDto(Scores, { vip: 5, standard: '3' })).toEqual({});
    expect(await validateDto(Scores, { vip: 5 })).toEqual({});
  });
});
