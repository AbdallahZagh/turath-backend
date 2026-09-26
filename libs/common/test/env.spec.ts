import { gatewayEnvSchema, parseApiKeys } from '@turath/common';
import { TEST_ENV } from '@turath/testing';

describe('parseApiKeys', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseApiKeys(' a , b,,c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns no keys for empty or missing values', () => {
    expect(parseApiKeys('')).toEqual([]);
    expect(parseApiKeys(undefined)).toEqual([]);
  });
});

describe('gatewayEnvSchema ADMIN_API_KEYS', () => {
  const check = (ADMIN_API_KEYS: string) => gatewayEnvSchema.validate({ ...TEST_ENV, ADMIN_API_KEYS }).error;

  it('allows an empty value (admin API disabled)', () => {
    expect(check('')).toBeUndefined();
  });

  it('allows several long keys', () => {
    expect(check(`${'a'.repeat(32)},${'b'.repeat(40)}`)).toBeUndefined();
  });

  it('rejects any key shorter than 32 characters', () => {
    expect(check(`${'a'.repeat(32)},short`)?.message).toMatch(/at least 32 characters/);
  });
});
