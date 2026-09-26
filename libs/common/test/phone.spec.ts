import { maskDestination, normalizeEmail, normalizePhone } from '@turath/common';

describe('normalizePhone', () => {
  it('reads Syrian national format by default', () => {
    expect(normalizePhone('0944 123 456')).toBe('+963944123456');
  });

  it('accepts international format', () => {
    expect(normalizePhone('+963 944 123 456')).toBe('+963944123456');
  });

  it('uses the given country for national numbers', () => {
    expect(normalizePhone('0791 234 5678', 'GB')).toBe('+447912345678');
  });

  it('returns null for invalid numbers', () => {
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('not a phone')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Rami.Haddad@Example.COM ')).toBe('rami.haddad@example.com');
  });
});

describe('maskDestination', () => {
  it('keeps the last three digits of a phone', () => {
    expect(maskDestination('phone', '+963944123456')).toBe('••• 456');
  });

  it('keeps the first letter and domain of an email', () => {
    expect(maskDestination('email', 'rami@example.com')).toBe('r•••@example.com');
  });
});
