import {
  IsBirthDate,
  IsCountryCode,
  IsEmailAddress,
  IsOneOf,
  IsOtpCode,
  IsPasswordInput,
  IsPersonName,
  IsPhoneFor,
  IsStrongPassword,
  IsText,
} from '@turath/common';
import { validateDto } from '@turath/testing';

class Sample {
  @IsText({ max: 5 }) text: string;
  @IsPersonName() name: string;
  @IsEmailAddress() email: string;
  @IsStrongPassword() password: string;
  @IsPasswordInput() currentPassword: string;
  @IsCountryCode() phoneCountry: string;
  @IsPhoneFor() phone: string;
  @IsOtpCode() code: string;
  @IsBirthDate() dateOfBirth: string;
  @IsOneOf(['a', 'b'], 'validation.CHANNEL') choice: string;
  @IsOneOf(['x'], 'validation.THEME', { optional: true }) optionalChoice?: string;
}

const valid = {
  text: 'hello',
  name: 'رامي حداد',
  email: 'Rami@Example.com',
  password: 'Turath2026',
  currentPassword: 'anything',
  phoneCountry: 'sy',
  phone: '0944 123 456',
  code: ' 123456 ',
  dateOfBirth: '1994-05-17',
  choice: 'a',
};

const errorsFor = (overrides: Record<string, unknown>) => validateDto(Sample, { ...valid, ...overrides });

describe('shared validation rules', () => {
  it('accept valid input (after normalising case, spaces and phone format)', async () => {
    expect(await errorsFor({})).toEqual({});
  });

  it('report exactly "required" for every missing required field', async () => {
    const errors = await validateDto(Sample, {});

    expect(Object.keys(errors)).toHaveLength(10);
    expect(new Set(Object.values(errors))).toEqual(new Set(['validation.REQUIRED']));
  });

  it('run checks in the listed order', async () => {
    expect(await errorsFor({ text: 42 })).toEqual({ text: 'validation.STRING' });
    expect(await errorsFor({ text: 'toolong' })).toEqual({ text: 'validation.MAX_LENGTH' });
    expect(await errorsFor({ name: 'R' })).toEqual({ name: 'validation.MIN_LENGTH' });
    expect(await errorsFor({ name: 'R2D2' })).toEqual({ name: 'validation.NAME' });
    expect(await errorsFor({ password: 'short1' })).toEqual({ password: 'validation.MIN_LENGTH' });
    expect(await errorsFor({ password: 'lettersonly' })).toEqual({ password: 'validation.PASSWORD_WEAK' });
    expect(await errorsFor({ dateOfBirth: '1994/05/17' })).toEqual({ dateOfBirth: 'validation.DATE' });
    expect(await errorsFor({ dateOfBirth: '2999-01-01' })).toEqual({ dateOfBirth: 'validation.DATE_OF_BIRTH' });
  });

  it('use the plain-words message for choices', async () => {
    expect(await errorsFor({ choice: 'z' })).toEqual({ choice: 'validation.CHANNEL' });
    expect(await errorsFor({ optionalChoice: 'z' })).toEqual({ optionalChoice: 'validation.THEME' });
  });

  it('read national phone numbers with the sibling country', async () => {
    expect(await errorsFor({ phoneCountry: 'GB', phone: '0791 234 5678' })).toEqual({});
    expect(await errorsFor({ phone: '12' })).toEqual({ phone: 'validation.PHONE' });
  });
});
