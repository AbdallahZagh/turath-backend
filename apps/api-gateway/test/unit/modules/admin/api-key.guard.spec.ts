import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AppException, CommonError } from '@turath/common';
import { ApiKeyGuard } from '../../../../src/modules/admin/api-key.guard.js';

const KEY_A = 'a'.repeat(40);
const KEY_B = 'b'.repeat(40);

const guardWith = (keys: string) => new ApiKeyGuard({ get: () => keys } as unknown as ConfigService);

const contextWith = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, ip: '127.0.0.1', method: 'GET', originalUrl: '/api/v1/admin' }),
    }),
  }) as unknown as ExecutionContext;

/** The guard must answer 404 (NOT_FOUND), never 401/403, so the admin API stays hidden. */
const expectHidden = (run: () => unknown) => {
  try {
    run();
    expect.unreachable('guard should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(CommonError.NOT_FOUND.code);
  }
};

describe('ApiKeyGuard', () => {
  it('lets a configured key through', () => {
    expect(guardWith(`${KEY_A},${KEY_B}`).canActivate(contextWith({ 'x-api-key': KEY_B }))).toBe(true);
  });

  it('hides the API when the key is missing', () => {
    expectHidden(() => guardWith(KEY_A).canActivate(contextWith({})));
  });

  it('hides the API when the key is wrong', () => {
    expectHidden(() => guardWith(KEY_A).canActivate(contextWith({ 'x-api-key': KEY_B })));
  });

  it('hides the API entirely when no keys are configured', () => {
    expectHidden(() => guardWith('').canActivate(contextWith({ 'x-api-key': KEY_A })));
  });
});
