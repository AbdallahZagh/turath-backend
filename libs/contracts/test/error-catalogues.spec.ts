import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@turath/common';
import { ERROR_CATALOGUES } from '@turath/contracts';

const translations = (lang: string, namespace: string): Record<string, string> =>
  JSON.parse(readFileSync(join(process.cwd(), 'i18n', lang, 'errors', `${namespace}.json`), 'utf8'));

describe('error catalogues', () => {
  it('has a namespace matching each catalogue key', () => {
    for (const [name, catalogue] of Object.entries(ERROR_CATALOGUES)) {
      for (const error of Object.values(catalogue)) expect(error.namespace, error.code).toBe(name);
    }
  });

  it('uses every code only once across all services', () => {
    const codes = Object.values(ERROR_CATALOGUES).flatMap((catalogue) => Object.keys(catalogue));
    expect(codes.filter((code, index) => codes.indexOf(code) !== index)).toEqual([]);
  });

  describe.each(Object.entries(ERROR_CATALOGUES))('%s', (namespace, catalogue) => {
    it.each(LOCALES)('has a %s message for every code, and none left over', (lang) => {
      const messages = translations(lang, namespace);

      expect(Object.keys(messages).sort()).toEqual(Object.keys(catalogue).sort());
      for (const [code, message] of Object.entries(messages)) expect(message.trim(), code).not.toBe('');
    });

    it('gives every code an HTTP error status', () => {
      for (const error of Object.values(catalogue)) expect(error.status, error.code).toBeGreaterThanOrEqual(400);
    });
  });

  it('uses the same {placeholders} in English and Arabic', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

    for (const namespace of Object.keys(ERROR_CATALOGUES)) {
      const en = translations('en', namespace);
      const ar = translations('ar', namespace);
      for (const code of Object.keys(en))
        expect(placeholders(ar[code]), `${namespace}.${code}`).toEqual(placeholders(en[code]));
    }
  });
});
