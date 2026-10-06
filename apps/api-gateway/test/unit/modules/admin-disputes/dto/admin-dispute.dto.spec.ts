import { validateDto } from '@turath/testing';
import {
  ListDisputesQueryDto,
  ResolveDisputeDto,
} from '../../../../../src/modules/admin-disputes/dto/admin-dispute.dto.js';

describe('ListDisputesQueryDto', () => {
  it('allows no filters at all', async () => {
    expect(await validateDto(ListDisputesQueryDto, {})).toEqual({});
  });

  it('allows every filter together, and converts page and limit from the query string', async () => {
    expect(
      await validateDto(ListDisputesQueryDto, {
        page: '2',
        limit: '50',
        category: 'guides',
        status: 'resolvedGuest',
        search: '  tarek  ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed category and status values', async () => {
    expect(await validateDto(ListDisputesQueryDto, { category: 'spa' })).toEqual({
      category: 'validation.BOOKING_CATEGORY',
    });
    expect(await validateDto(ListDisputesQueryDto, { status: 'closed' })).toEqual({
      status: 'validation.DISPUTE_STATUS',
    });
  });

  it('rejects a bad page or limit', async () => {
    expect(await validateDto(ListDisputesQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListDisputesQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListDisputesQueryDto, { limit: 'ten' })).toEqual({ limit: 'validation.INTEGER' });
  });

  it('rejects a search that is too long', async () => {
    expect(await validateDto(ListDisputesQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
  });

  it('rejects unknown query parameters', async () => {
    expect(Object.keys(await validateDto(ListDisputesQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});

describe('ResolveDisputeDto', () => {
  const notes = { en: 'Table photo confirmed the double booking.', ar: 'صورة الطاولة تؤكد الحجز المزدوج.' };

  it.each(['resolvedGuest', 'resolvedProvider'])('accepts %s with notes', async (status) => {
    expect(await validateDto(ResolveDisputeDto, { status, notes })).toEqual({});
  });

  it('allows empty notes in either language', async () => {
    expect(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: { en: '', ar: '   ' } })).toEqual({});
  });

  it('requires a status and notes', async () => {
    expect(await validateDto(ResolveDisputeDto, {})).toEqual({
      status: 'validation.REQUIRED',
      notes: 'validation.REQUIRED',
    });
  });

  it('does not accept open or an unknown status', async () => {
    expect(await validateDto(ResolveDisputeDto, { status: 'open', notes })).toEqual({
      status: 'validation.DISPUTE_RESOLUTION',
    });
    expect(await validateDto(ResolveDisputeDto, { status: 'RESOLVED_GUEST', notes })).toEqual({
      status: 'validation.DISPUTE_RESOLUTION',
    });
  });

  it('requires both languages of the notes', async () => {
    expect(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: { en: 'Only English' } })).toEqual({
      'notes.ar': 'validation.REQUIRED',
    });
  });

  it('rejects notes that are not text or are too long', async () => {
    expect(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: { en: 5, ar: '' } })).toEqual({
      'notes.en': 'validation.STRING',
    });
    expect(
      await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: { en: 'x'.repeat(1001), ar: '' } }),
    ).toEqual({ 'notes.en': 'validation.MAX_LENGTH' });
  });

  it('rejects notes that are not an object', async () => {
    expect(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: 'because' })).toEqual({
      notes: 'validation.OBJECT',
    });
  });

  it('rejects extra fields, also inside the notes', async () => {
    expect(Object.keys(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes, amountSyp: 0 }))).toEqual(
      ['amountSyp'],
    );
    expect(
      Object.keys(await validateDto(ResolveDisputeDto, { status: 'resolvedGuest', notes: { ...notes, fr: 'x' } })),
    ).toEqual(['notes.fr']);
  });
});
