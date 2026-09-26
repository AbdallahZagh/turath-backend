import { validateDto } from '@turath/testing';
import { UpdatePreferencesDto } from '../../../../../src/modules/preferences/dto/preferences.dto.js';

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
