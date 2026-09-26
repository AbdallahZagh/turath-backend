import { buildRegisterBody, validateDto } from '@turath/testing';
import { RegisterDto } from '../../../src/auth/auth.dto.js';

const errorsFor = (overrides: Record<string, unknown>) => validateDto(RegisterDto, buildRegisterBody(overrides));

describe('RegisterDto', () => {
  it('accepts a valid tourist', async () => {
    expect(await errorsFor({})).toEqual({});
  });

  it('accepts a valid provider with a provider type', async () => {
    expect(await errorsFor({ accountType: 'PROVIDER', providerType: 'HOTEL' })).toEqual({});
  });

  it('reports "required" (and only that) for every missing field', async () => {
    expect(await validateDto(RegisterDto, {})).toEqual({
      accountType: 'validation.REQUIRED',
      name: 'validation.REQUIRED',
      dateOfBirth: 'validation.REQUIRED',
      nationality: 'validation.REQUIRED',
      phoneCountry: 'validation.REQUIRED',
      phone: 'validation.REQUIRED',
      email: 'validation.REQUIRED',
      password: 'validation.REQUIRED',
    });
  });

  describe('accountType / providerType', () => {
    it('rejects an unknown account type', async () => {
      expect(await errorsFor({ accountType: 'GUIDE' })).toEqual({ accountType: 'validation.ACCOUNT_TYPE' });
    });

    it('requires a provider type for providers', async () => {
      expect(await errorsFor({ accountType: 'PROVIDER' })).toEqual({ providerType: 'validation.REQUIRED' });
    });

    it('rejects an unknown provider type', async () => {
      expect(await errorsFor({ accountType: 'PROVIDER', providerType: 'SPA' })).toEqual({
        providerType: 'validation.PROVIDER_TYPE',
      });
    });

    it('rejects a provider type on a tourist account', async () => {
      expect(await errorsFor({ providerType: 'HOTEL' })).toEqual({
        providerType: 'validation.PROVIDER_TYPE_NOT_ALLOWED',
      });
    });

    it('allows providerType: null for tourists', async () => {
      expect(await errorsFor({ providerType: null })).toEqual({});
    });
  });

  describe('name', () => {
    it.each(['سارة الأحمد', 'عبد الرحمن', "Abd al-Rahman O'Neil", 'J. Smith'])('accepts %s', async (name) => {
      expect(await errorsFor({ name })).toEqual({});
    });

    it.each(['R2D2', 'Rami_Haddad', 'Rami!'])('rejects %s', async (name) => {
      expect(await errorsFor({ name })).toEqual({ name: 'validation.NAME' });
    });

    it('enforces 2–100 characters', async () => {
      expect(await errorsFor({ name: 'R' })).toEqual({ name: 'validation.MIN_LENGTH' });
      expect(await errorsFor({ name: 'a'.repeat(101) })).toEqual({ name: 'validation.MAX_LENGTH' });
    });
  });

  describe('dateOfBirth', () => {
    it('rejects a wrong format', async () => {
      expect(await errorsFor({ dateOfBirth: '17-05-1994' })).toEqual({ dateOfBirth: 'validation.DATE' });
    });

    it('rejects future dates and dates before 1900', async () => {
      expect(await errorsFor({ dateOfBirth: '2090-01-01' })).toEqual({ dateOfBirth: 'validation.DATE_OF_BIRTH' });
      expect(await errorsFor({ dateOfBirth: '1899-12-31' })).toEqual({ dateOfBirth: 'validation.DATE_OF_BIRTH' });
    });
  });

  describe('contact fields', () => {
    it('upper-cases country codes and rejects unknown ones', async () => {
      expect(await errorsFor({ nationality: 'sy' })).toEqual({});
      expect(await errorsFor({ nationality: 'XX' })).toEqual({ nationality: 'validation.COUNTRY' });
    });

    it('rejects an invalid phone', async () => {
      expect(await errorsFor({ phone: '12' })).toEqual({ phone: 'validation.PHONE' });
    });

    it('rejects an invalid email', async () => {
      expect(await errorsFor({ email: 'nope' })).toEqual({ email: 'validation.EMAIL' });
    });
  });

  describe('password', () => {
    it('needs at least 8 characters', async () => {
      expect(await errorsFor({ password: 'Ab1' })).toEqual({ password: 'validation.MIN_LENGTH' });
    });

    it('needs a letter and a number', async () => {
      expect(await errorsFor({ password: 'lettersonly' })).toEqual({ password: 'validation.PASSWORD_WEAK' });
      expect(await errorsFor({ password: '1234567890' })).toEqual({ password: 'validation.PASSWORD_WEAK' });
    });
  });

  it('rejects fields that are not part of the API', async () => {
    expect(await errorsFor({ role: 'SUPER_ADMIN' })).toEqual({ role: expect.any(String) });
  });
});
