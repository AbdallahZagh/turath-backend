import { validateDto } from '@turath/testing';
import {
  LoginEmailDto,
  LoginPhoneDto,
  LoginPhoneVerifyDto,
  ResetPasswordDto,
  SendOtpDto,
  UpdatePreferencesDto,
  VerifyOtpDto,
} from '../../../src/auth/auth.dto.js';

describe('LoginEmailDto', () => {
  it('requires email and password', async () => {
    expect(await validateDto(LoginEmailDto, {})).toEqual({
      email: 'validation.REQUIRED',
      password: 'validation.REQUIRED',
    });
  });

  it('accepts any-case email', async () => {
    expect(await validateDto(LoginEmailDto, { email: 'Rami@Example.com', password: 'x' })).toEqual({});
  });
});

describe('LoginPhoneDto / LoginPhoneVerifyDto', () => {
  it('requires phoneCountry and phone', async () => {
    expect(await validateDto(LoginPhoneDto, {})).toEqual({
      phoneCountry: 'validation.REQUIRED',
      phone: 'validation.REQUIRED',
    });
  });

  it('reads the phone with its country', async () => {
    expect(await validateDto(LoginPhoneDto, { phoneCountry: 'sy', phone: '0944 123 456' })).toEqual({});
  });

  it('requires a 6-digit code', async () => {
    const body = { phoneCountry: 'SY', phone: '0944123456' };
    expect(await validateDto(LoginPhoneVerifyDto, body)).toEqual({ code: 'validation.REQUIRED' });
    expect(await validateDto(LoginPhoneVerifyDto, { ...body, code: '12ab' })).toEqual({ code: 'validation.OTP' });
    expect(await validateDto(LoginPhoneVerifyDto, { ...body, code: '123456' })).toEqual({});
  });
});

describe('SendOtpDto / VerifyOtpDto', () => {
  it('names the channel choice in plain words', async () => {
    expect(await validateDto(SendOtpDto, { channel: 'fax', destination: 'x' })).toMatchObject({
      channel: 'validation.CHANNEL',
    });
  });

  it('validates destination against the channel', async () => {
    expect(await validateDto(SendOtpDto, { channel: 'email', destination: 'nope' })).toEqual({
      destination: 'validation.EMAIL',
    });
    expect(await validateDto(SendOtpDto, { channel: 'phone', destination: '12' })).toEqual({
      destination: 'validation.PHONE',
    });
  });

  it('requires the code when verifying', async () => {
    expect(await validateDto(VerifyOtpDto, { channel: 'phone', destination: '0944123456' })).toEqual({
      code: 'validation.REQUIRED',
    });
  });
});

describe('ResetPasswordDto', () => {
  it('requires token and password', async () => {
    expect(await validateDto(ResetPasswordDto, {})).toEqual({
      token: 'validation.REQUIRED',
      password: 'validation.REQUIRED',
    });
  });

  it('applies the signup password rule', async () => {
    expect(await validateDto(ResetPasswordDto, { token: 't', password: 'lettersonly' })).toEqual({
      password: 'validation.PASSWORD_WEAK',
    });
  });

  it('rejects an over-long token', async () => {
    expect(await validateDto(ResetPasswordDto, { token: 'x'.repeat(201), password: 'Turath2026' })).toEqual({
      token: 'validation.RESET_TOKEN',
    });
  });
});

describe('UpdatePreferencesDto', () => {
  it('allows an empty body', async () => {
    expect(await validateDto(UpdatePreferencesDto, {})).toEqual({});
  });

  it('explains the allowed values', async () => {
    expect(await validateDto(UpdatePreferencesDto, { locale: 'fr', theme: 'blue' })).toEqual({
      locale: 'validation.LOCALE',
      theme: 'validation.THEME',
    });
  });
});
