import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from '../directory/directory.controller';
import { OwnerController } from './owner.controller';
import { OwnerAttentionService } from './owner-attention.service';
import { OwnerHealthService } from './owner-health.service';

interface AttentionDouble {
  collect: jest.Mock;
}
interface HealthDouble {
  check: jest.Mock;
}

describe('OwnerController', () => {
  const attention: AttentionDouble = { collect: jest.fn() };
  const health: HealthDouble = { check: jest.fn() };
  const controller = new OwnerController(
    attention as unknown as OwnerAttentionService,
    health as unknown as OwnerHealthService
  );

  it('requires a session and the owner-console scope on every route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OwnerController);
    expect(guards).toEqual([AuthGuard, DirectoryOwnerScopeGuard]);
  });

  it('rejects any other app scope with 403', () => {
    const context = (scope?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-ot-appscope': scope } }),
        }),
      } as unknown as ExecutionContext);
    const guard = new DirectoryOwnerScopeGuard();
    expect(() => guard.canActivate(context('local-hub'))).toThrow(
      ForbiddenException
    );
    expect(() => guard.canActivate(context(undefined))).toThrow(
      ForbiddenException
    );
    expect(guard.canActivate(context('owner-console'))).toBe(true);
  });

  it('passes the session actor, never a body value, to attention', async () => {
    attention.collect.mockResolvedValue({ generatedAt: 'now', items: [] });
    await controller.getAttention({ user: { userId: 'u1', profileId: 'p1' } });
    expect(attention.collect).toHaveBeenCalledWith({
      userId: 'u1',
      profileId: 'p1',
    });
  });

  it('returns the health sweep', async () => {
    health.check.mockResolvedValue([{ name: 'x', status: 'up' }]);
    await expect(controller.getHealth()).resolves.toEqual([
      { name: 'x', status: 'up' },
    ]);
  });
});
