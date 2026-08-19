import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceContextGuard } from './workspace-context.guard';
import {
  WORKSPACE_CONTEXT_KEY,
  WorkspaceContextRequirement,
} from '../decorators/workspace-context.decorator';

describe('WorkspaceContextGuard', () => {
  const handler = () => undefined;
  const makeContext = (request: any) =>
    ({
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as any);

  it('resolves the configured slug into a trusted request context before authorization', async () => {
    const requirement: WorkspaceContextRequirement = {
      kind: 'business-site',
      source: 'query',
      path: 'slug',
      strict: true,
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requirement),
    } as unknown as Reflector;
    const resolver = {
      resolveContext: jest
        .fn()
        .mockResolvedValue({
          workspace: { workspaceId: 'workspace-1' },
          workspaceScope: 'workspace:workspace-1',
        }),
    } as any;
    const guard = new WorkspaceContextGuard(reflector, resolver, {
      send: jest.fn(),
    } as any);
    const request: any = {
      headers: { 'x-ot-appscope': 'business-site' },
      query: { slug: 'north-star' },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(resolver.resolveContext).toHaveBeenCalledWith(
      'business-site',
      'business-site',
      'north-star'
    );
    expect(request.workspaceContext).toEqual({
      workspace: { workspaceId: 'workspace-1' },
      workspaceScope: 'workspace:workspace-1',
      strict: true,
    });
  });

  it('rejects a decorated route without its required server-side workspace selector', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue({
          kind: 'business-site',
          source: 'query',
          path: 'slug',
          strict: true,
        }),
    } as unknown as Reflector;
    const guard = new WorkspaceContextGuard(
      reflector,
      { resolveContext: jest.fn() } as any,
      { send: jest.fn() } as any
    );

    await expect(
      guard.canActivate(
        makeContext({
          headers: { 'x-ot-appscope': 'business-site' },
          query: {},
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
