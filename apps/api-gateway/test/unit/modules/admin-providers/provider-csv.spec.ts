import { toCsv } from '../../../../src/core/csv/csv.js';
import { providerCsv, providerCsvFilename } from '../../../../src/modules/admin-providers/provider-csv.js';

const labels: Record<string, string> = {
  'common.CSV_BUSINESS': 'Business',
  'common.CSV_OWNER': 'Owner',
  'common.CSV_CATEGORY': 'Category',
  'common.CSV_REGION': 'Region',
  'common.CSV_STATUS': 'Status',
  'common.CSV_SUBMITTED': 'Submitted',
  'common.PILLAR_hotels': 'Hotels',
  'common.GOVERNORATE_damascus': 'Damascus',
  'common.PROVIDER_STATUS_approved': 'Approved',
};
const t = (key: string) => labels[key] ?? key;

const row = {
  id: '1',
  name: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
  owner: { en: 'Lina Nasser', ar: 'لينا ناصر' },
  category: 'hotels' as const,
  governorate: 'damascus' as const,
  status: 'approved' as const,
  submittedAt: '2026-06-12',
};

describe('toCsv', () => {
  it('starts with a byte order mark and uses CRLF lines', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']]);

    expect(csv).toBe('﻿a,b\r\n1,2');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv(['x'], [['a,b'], ['say "hi"'], ['two\nlines']])).toBe('﻿x\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"');
  });

  it('leaves null and undefined empty and writes numbers and booleans', () => {
    expect(toCsv(['a', 'b', 'c', 'd'], [[null, undefined, 5, true]])).toBe('﻿a,b,c,d\r\n,,5,true');
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx'])('stops %j from running as a formula', (text) => {
    expect(toCsv(['x'], [[text]]).split('\r\n')[1]).toBe(`'${text}`);
  });

  it('does not touch negative numbers', () => {
    expect(toCsv(['x'], [[-5]]).split('\r\n')[1]).toBe('-5');
  });
});

describe('providerCsv', () => {
  it('writes the six columns of the table in English', () => {
    expect(providerCsv([row], t, 'en')).toBe(
      '﻿Business,Owner,Category,Region,Status,Submitted\r\nBeit Al-Wali,Lina Nasser,Hotels,Damascus,Approved,"Jun 12, 2026"',
    );
  });

  it('uses the Arabic names for Arabic', () => {
    const [, line] = providerCsv([row], t, 'ar').split('\r\n');

    expect(line.startsWith('بيت الوالي,لينا ناصر,')).toBe(true);
  });

  it('is only the header row when nothing matches', () => {
    expect(providerCsv([], t, 'en')).toBe('﻿Business,Owner,Category,Region,Status,Submitted');
  });
});

describe('providerCsvFilename', () => {
  it('carries the day', () => {
    expect(providerCsvFilename(new Date('2026-10-05T23:59:00Z'))).toBe('turath-businesses-2026-10-05.csv');
  });
});
