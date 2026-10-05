import type { AdminProviderExportRow } from '@turath/contracts';
import { toCsv } from '../../core/csv/csv.js';

type Translate = (key: string) => string;

/**
 * The businesses CSV, with the same columns and words as the frontend's export
 * (business, owner, category, region, status, submitted) in the request language.
 */
export function providerCsv(rows: AdminProviderExportRow[], t: Translate, lang: string): string {
  const arabic = lang === 'ar';
  const date = new Intl.DateTimeFormat(arabic ? 'ar-u-nu-latn' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' });

  return toCsv(
    [
      t('common.CSV_BUSINESS'),
      t('common.CSV_OWNER'),
      t('common.CSV_CATEGORY'),
      t('common.CSV_REGION'),
      t('common.CSV_STATUS'),
      t('common.CSV_SUBMITTED'),
    ],
    rows.map((provider) => [
      arabic ? provider.name.ar : provider.name.en,
      arabic ? provider.owner.ar : provider.owner.en,
      t(`common.PILLAR_${provider.category}`),
      t(`common.GOVERNORATE_${provider.governorate}`),
      t(`common.PROVIDER_STATUS_${provider.status}`),
      date.format(new Date(`${provider.submittedAt}T00:00:00Z`)),
    ]),
  );
}

/** `turath-businesses-2026-10-05.csv` */
export const providerCsvFilename = (today = new Date()) => `turath-businesses-${today.toISOString().slice(0, 10)}.csv`;
