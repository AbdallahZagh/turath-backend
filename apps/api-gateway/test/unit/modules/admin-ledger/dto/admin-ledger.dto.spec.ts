import { validateDto } from '@turath/testing';
import { ListLedgerQueryDto } from '../../../../../src/modules/admin-ledger/dto/admin-ledger.dto.js';

describe('ListLedgerQueryDto', () => {
  it('allows no filters at all', async () => {
    expect(await validateDto(ListLedgerQueryDto, {})).toEqual({});
  });

  it('allows every filter together, and converts page and limit from the query string', async () => {
    expect(
      await validateDto(ListLedgerQueryDto, {
        page: '2',
        limit: '50',
        category: 'dining',
        standing: 'watch',
        search: '  beit  ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed category and standing values', async () => {
    expect(await validateDto(ListLedgerQueryDto, { category: 'spa' })).toEqual({
      category: 'validation.BOOKING_CATEGORY',
    });
    expect(await validateDto(ListLedgerQueryDto, { standing: 'bad' })).toEqual({
      standing: 'validation.LEDGER_STANDING',
    });
  });

  it('rejects a bad page or limit', async () => {
    expect(await validateDto(ListLedgerQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListLedgerQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListLedgerQueryDto, { limit: 'ten' })).toEqual({ limit: 'validation.INTEGER' });
  });

  it('rejects a search that is too long', async () => {
    expect(await validateDto(ListLedgerQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
  });

  it('rejects unknown query parameters', async () => {
    expect(Object.keys(await validateDto(ListLedgerQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});
