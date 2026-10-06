import { validateDto } from '@turath/testing';
import { SaveFeesDto } from '../../../../../src/modules/admin-fees/dto/admin-fees.dto.js';

const rates = { hotels: 0.12, dining: 0.12, trips: 0.1, events: 0.12, guides: 0.085 };
const body = { sypPerUsd: 14_286, rates };

describe('SaveFeesDto', () => {
  it('accepts a full, valid body', async () => {
    expect(await validateDto(SaveFeesDto, body)).toEqual({});
  });

  it('accepts the edges: rates of 0 and 1, an exchange rate of 1', async () => {
    expect(
      await validateDto(SaveFeesDto, { sypPerUsd: 1, rates: { ...rates, hotels: 0, guides: 1, trips: 0.0001 } }),
    ).toEqual({});
  });

  it('requires the exchange rate and the rates', async () => {
    expect(await validateDto(SaveFeesDto, {})).toEqual({
      sypPerUsd: 'validation.REQUIRED',
      rates: 'validation.REQUIRED',
    });
  });

  it('rejects an exchange rate that is not a whole number from 1 up', async () => {
    expect(await validateDto(SaveFeesDto, { ...body, sypPerUsd: 0 })).toEqual({ sypPerUsd: 'validation.MIN_VALUE' });
    expect(await validateDto(SaveFeesDto, { ...body, sypPerUsd: 14_286.5 })).toEqual({
      sypPerUsd: 'validation.INTEGER',
    });
    expect(await validateDto(SaveFeesDto, { ...body, sypPerUsd: 'lots' })).toEqual({
      sypPerUsd: 'validation.INTEGER',
    });
    expect(await validateDto(SaveFeesDto, { ...body, sypPerUsd: 100_000_001 })).toEqual({
      sypPerUsd: 'validation.MAX_VALUE',
    });
  });

  it('requires every category, naming the one that is missing', async () => {
    const { guides: _guides, ...four } = rates;

    expect(await validateDto(SaveFeesDto, { ...body, rates: four })).toEqual({
      'rates.guides': 'validation.REQUIRED',
    });
  });

  it('rejects a rate outside 0-1, with too many decimals, or not a number', async () => {
    const withRate = (hotels: unknown) => validateDto(SaveFeesDto, { ...body, rates: { ...rates, hotels } });

    expect(await withRate(-0.1)).toEqual({ 'rates.hotels': 'validation.MIN_VALUE' });
    expect(await withRate(12)).toEqual({ 'rates.hotels': 'validation.MAX_VALUE' });
    expect(await withRate(0.12345)).toEqual({ 'rates.hotels': 'validation.RATE' });
    expect(await withRate('0.12')).toEqual({ 'rates.hotels': 'validation.RATE' });
    expect(await withRate(null)).toEqual({ 'rates.hotels': 'validation.REQUIRED' });
  });

  it('rejects rates that are not an object', async () => {
    expect(await validateDto(SaveFeesDto, { ...body, rates: 0.12 })).toEqual({ rates: 'validation.OBJECT' });
  });

  it('rejects extra fields, also inside the rates', async () => {
    expect(Object.keys(await validateDto(SaveFeesDto, { ...body, tax: 1 }))).toEqual(['tax']);
    expect(Object.keys(await validateDto(SaveFeesDto, { ...body, rates: { ...rates, spa: 0.1 } }))).toEqual([
      'rates.spa',
    ]);
  });
});
