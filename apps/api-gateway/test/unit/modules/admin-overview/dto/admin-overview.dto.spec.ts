import { validateDto } from '@turath/testing';
import { OverviewQueryDto } from '../../../../../src/modules/admin-overview/dto/admin-overview.dto.js';
import { ListUsersQueryDto } from '../../../../../src/modules/admin-users/dto/admin-user.dto.js';

describe('OverviewQueryDto', () => {
  it('allows no period, and any whole number of days from 1 to 365', async () => {
    expect(await validateDto(OverviewQueryDto, {})).toEqual({});
    expect(await validateDto(OverviewQueryDto, { days: '1' })).toEqual({});
    expect(await validateDto(OverviewQueryDto, { days: '90' })).toEqual({});
    expect(await validateDto(OverviewQueryDto, { days: '365', lang: 'ar' })).toEqual({});
  });

  it('rejects anything else', async () => {
    for (const days of ['0', '366', '-7', '7.5', 'week', '']) {
      expect(Object.keys(await validateDto(OverviewQueryDto, { days }))).toEqual(['days']);
    }
  });
});

describe('ListUsersQueryDto', () => {
  it('allows no filters, and every filter together', async () => {
    expect(await validateDto(ListUsersQueryDto, {})).toEqual({});
    expect(
      await validateDto(ListUsersQueryDto, {
        page: '2',
        limit: '50',
        account: 'locked',
        reliability: 'suspended',
        search: 'rami',
      }),
    ).toEqual({});
  });

  it('accepts every account filter and tier', async () => {
    for (const account of ['active', 'locked']) {
      expect(await validateDto(ListUsersQueryDto, { account })).toEqual({});
    }
    for (const reliability of ['vip', 'standard', 'restricted', 'suspended']) {
      expect(await validateDto(ListUsersQueryDto, { reliability })).toEqual({});
    }
  });

  it('rejects an unknown account or tier, and a search over 100 characters', async () => {
    const errors = await validateDto(ListUsersQueryDto, {
      account: 'banned',
      reliability: 'gold',
      search: 'a'.repeat(101),
    });

    expect(Object.keys(errors).sort()).toEqual(['account', 'reliability', 'search']);
  });

  it('trims the search', async () => {
    expect(await validateDto(ListUsersQueryDto, { search: '   ' })).toEqual({});
  });
});
