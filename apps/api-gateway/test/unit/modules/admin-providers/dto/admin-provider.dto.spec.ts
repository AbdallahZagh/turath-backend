import { validateDto } from '@turath/testing';
import {
  ExportProvidersQueryDto,
  ListProvidersQueryDto,
} from '../../../../../src/modules/admin-providers/dto/admin-provider.dto.js';

describe('ListProvidersQueryDto', () => {
  it('allows no filters at all', async () => {
    expect(await validateDto(ListProvidersQueryDto, {})).toEqual({});
  });

  it('allows every filter together', async () => {
    expect(
      await validateDto(ListProvidersQueryDto, {
        page: '2',
        limit: '50',
        status: 'suspended',
        category: 'trips',
        governorate: 'palmyra',
        search: '  dive ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains each allowed value', async () => {
    expect(await validateDto(ListProvidersQueryDto, { status: 'active' })).toEqual({
      status: 'validation.PROVIDER_STATUS',
    });
    expect(await validateDto(ListProvidersQueryDto, { category: 'spa' })).toEqual({
      category: 'validation.PROVIDER_CATEGORY',
    });
    expect(await validateDto(ListProvidersQueryDto, { governorate: 'paris' })).toEqual({
      governorate: 'validation.GOVERNORATE',
    });
  });

  it('rejects a bad page, limit and search', async () => {
    expect(await validateDto(ListProvidersQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListProvidersQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListProvidersQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
  });

  it('rejects unknown query parameters', async () => {
    expect(Object.keys(await validateDto(ListProvidersQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});

describe('ExportProvidersQueryDto', () => {
  it('takes the same filters', async () => {
    expect(await validateDto(ExportProvidersQueryDto, { status: 'pending', governorate: 'homs', lang: 'ar' })).toEqual(
      {},
    );
    expect(await validateDto(ExportProvidersQueryDto, { status: 'nope' })).toEqual({
      status: 'validation.PROVIDER_STATUS',
    });
  });

  it('has no paging: page and limit are not allowed', async () => {
    expect(Object.keys(await validateDto(ExportProvidersQueryDto, { page: '1', limit: '10' })).sort()).toEqual([
      'limit',
      'page',
    ]);
  });
});
