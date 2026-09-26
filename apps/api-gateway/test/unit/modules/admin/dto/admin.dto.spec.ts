import { validateDto } from '@turath/testing';
import { CreateAdminDto, UpdateAdminDto } from '../../../../../src/modules/admin/dto/admin.dto.js';

const valid = {
  name: 'Lina Admin',
  role: 'ADMIN',
  permissions: ['users:read'],
  email: 'lina@example.com',
  password: 'VeryStrong2026',
};

describe('CreateAdminDto', () => {
  it('accepts a valid admin', async () => {
    expect(await validateDto(CreateAdminDto, valid)).toEqual({});
  });

  it('allows an empty permission list', async () => {
    expect(await validateDto(CreateAdminDto, { ...valid, role: 'SUPER_ADMIN', permissions: [] })).toEqual({});
  });

  it('requires every field', async () => {
    expect(await validateDto(CreateAdminDto, {})).toEqual({
      name: 'validation.REQUIRED',
      role: 'validation.REQUIRED',
      permissions: 'validation.REQUIRED',
      email: 'validation.REQUIRED',
      password: 'validation.REQUIRED',
    });
  });

  it('explains role and permission problems', async () => {
    expect(await validateDto(CreateAdminDto, { ...valid, role: 'BOSS' })).toEqual({ role: 'validation.ADMIN_ROLE' });
    expect(await validateDto(CreateAdminDto, { ...valid, permissions: 'users:read' })).toEqual({
      permissions: 'validation.LIST',
    });
    expect(await validateDto(CreateAdminDto, { ...valid, permissions: ['users:read', 'users:read'] })).toEqual({
      permissions: 'validation.NO_DUPLICATES',
    });
    expect(await validateDto(CreateAdminDto, { ...valid, permissions: ['fly'] })).toEqual({
      permissions: 'validation.ADMIN_PERMISSION',
    });
  });

  it('needs a 12+ character password with a letter and a number', async () => {
    expect(await validateDto(CreateAdminDto, { ...valid, password: 'Short1' })).toEqual({
      password: 'validation.MIN_LENGTH',
    });
    expect(await validateDto(CreateAdminDto, { ...valid, password: 'onlylettershere' })).toEqual({
      password: 'validation.PASSWORD_WEAK',
    });
  });
});

describe('UpdateAdminDto', () => {
  it('makes every field optional', async () => {
    expect(await validateDto(UpdateAdminDto, {})).toEqual({});
  });

  it('only takes a boolean for locked', async () => {
    expect(await validateDto(UpdateAdminDto, { locked: 'yes' })).toEqual({ locked: 'validation.BOOLEAN' });
    expect(await validateDto(UpdateAdminDto, { locked: true })).toEqual({});
  });
});
