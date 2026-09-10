import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import {
  WORKSPACE_CONTEXT_KEY,
  WorkspaceContextRequirement,
} from '../../decorators/workspace-context.decorator';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { AppConfigController } from './app-config.controller';
import { Reflector } from '@nestjs/core';

describe('Gateway AppConfigController metadata', () => {
  const controller = AppConfigController.prototype;

  function expectMutationGuarded(
    methodName: keyof AppConfigController,
    permission: string
  ) {
    const handler = controller[methodName] as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(guards).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(requirement).toEqual({ permissions: [permission] });
  }

  const user = {
    userId: 'user-owner-a',
    profileId: 'profile-owner-a',
  } as any;
  const workspace = {
    workspaceId: 'workspace-a',
    kind: 'business-site',
    slug: 'north-star',
    displayName: 'North Star',
    appScope: 'business-site',
    ownerUserId: user.userId,
    ownerProfileId: user.profileId,
    status: 'active',
    source: { service: 'store', sourceId: 'site-config-a' },
  } as any;
  const resolvedContext = {
    ownerUserId: user.userId,
    ownerProfileId: user.profileId,
    appScope: 'business-site',
    workspaceId: workspace.workspaceId,
    appInstanceId: 'app-instance-a',
    membershipId: 'membership-a',
    membershipRole: 'owner',
    membershipStatus: 'active',
  };
  const request = {
    headers: { 'x-ot-appscope': 'business-site' },
    query: { workspaceSlug: workspace.slug },
    workspaceContext: {
      workspace,
      workspaceScope: `workspace:${workspace.workspaceId}`,
      strict: true,
    },
  };

  function createClient(
    context: Record<string, unknown> = resolvedContext,
    resolutionError?: unknown
  ) {
    return {
      send: jest.fn((command: { cmd: string }) => {
        if (command.cmd === 'app-config.resolveContext') {
          return resolutionError
            ? throwError(() => resolutionError)
            : of(context);
        }
        return of({ id: 'config-1' });
      }),
    };
  }

  function invokeGetAll(
    controllerInstance: AppConfigController,
    clientRequest = request,
    authenticatedUser = user,
    appScope = 'business-site'
  ) {
    return (controllerInstance as any).getAllConfigurations(
      authenticatedUser,
      appScope,
      clientRequest
    );
  }

  it('protects app configuration mutations with explicit permissions', () => {
    expectMutationGuarded('createConfiguration', 'app-config.create');
    expectMutationGuarded('updateConfiguration', 'app-config.update');
    expectMutationGuarded('publishConfiguration', 'app-config.update');
    expectMutationGuarded('rollbackConfiguration', 'app-config.update');
    expectMutationGuarded('deleteConfiguration', 'app-config.delete');
  });

  it('requires authenticated canonical workspace context on every protected route', () => {
    const protectedMethods = [
      'createConfiguration',
      'getAllConfigurations',
      'getConfigurationByName',
      'getConfiguration',
      'updateConfiguration',
      'publishConfiguration',
      'rollbackConfiguration',
      'deleteConfiguration',
    ] as const;

    for (const methodName of protectedMethods) {
      const handler = controller[methodName] as unknown as Function;
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      const requirement = Reflect.getMetadata(
        WORKSPACE_CONTEXT_KEY,
        handler
      ) as WorkspaceContextRequirement;

      expect(guards).toEqual(
        expect.arrayContaining([
          AuthGuard,
          WorkspaceContextGuard,
          PermissionsGuard,
        ])
      );
      expect(requirement).toEqual({
        supportedKinds: ['business-site', 'community'],
        source: 'query',
        path: 'workspaceSlug',
        strict: true,
      });
    }
  });

  it('keeps published-domain lookup anonymous and unchanged', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await appConfigController.getConfigurationByDomain('public.example');

    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        controller.getConfigurationByDomain as unknown as Function
      )
    ).toBeUndefined();
    expect(client.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.GetPublishedByDomain },
      { domain: 'public.example' }
    );
  });

  it('resolves and forwards the complete authoritative app context', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await invokeGetAll(appConfigController);

    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'app-config.resolveContext' },
      {
        ownerUserId: user.userId,
        ownerProfileId: user.profileId,
        workspaceId: workspace.workspaceId,
        appScope: 'business-site',
      }
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppConfigCommands.GetAll },
      { context: resolvedContext }
    );
  });

  it('routes a successful delete through the mutation transport and returns its acknowledgement', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) => {
        if (command.cmd === 'app-config.resolveContext')
          return of(resolvedContext);
        if (command.cmd === AppConfigCommands.Delete) {
          return of({ deleted: true });
        }
        return of({ id: 'config-1' });
      }),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(
      appConfigController.deleteConfiguration(
        'config-1',
        user,
        'business-site',
        request
      )
    ).resolves.toEqual({ deleted: true });

    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppConfigCommands.Delete },
      { id: 'config-1', context: resolvedContext }
    );
  });

  it('preserves a missing configuration as HTTP 404 after the delete RPC', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) => {
        if (command.cmd === 'app-config.resolveContext')
          return of(resolvedContext);
        if (command.cmd === AppConfigCommands.Delete) {
          return throwError(() => ({
            statusCode: 404,
            message: 'Configuration with ID config-1 not found',
          }));
        }
        return of({ id: 'config-1' });
      }),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(
      appConfigController.deleteConfiguration(
        'config-1',
        user,
        'business-site',
        request
      )
    ).rejects.toMatchObject({
      status: 404,
      response: 'Configuration with ID config-1 not found',
    });
  });

  it.each(['appInstanceId', 'membershipId'] as const)(
    'rejects a resolved context with an empty %s at the Gateway boundary',
    async (field) => {
      const client = createClient({ ...resolvedContext, [field]: '  ' });
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        client as any
      );

      await expect(invokeGetAll(appConfigController)).rejects.toMatchObject({
        status: 503,
        response: expect.objectContaining({
          message: expect.stringContaining('incomplete'),
        }),
      });
      expect(client.send).toHaveBeenCalledTimes(1);
    }
  );

  it('ignores client-supplied app instance and membership fields', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await (appConfigController as any).updateConfiguration(
      'config-1',
      {
        manifest: { schemaVersion: 1 },
        appInstanceId: 'forged-app',
        membershipId: 'forged-membership',
        membershipRole: 'member',
        membershipStatus: 'active',
      },
      user,
      'business-site',
      request
    );

    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'app-config.resolveContext' },
      expect.not.objectContaining({
        appInstanceId: 'forged-app',
        membershipId: 'forged-membership',
        membershipRole: 'member',
        membershipStatus: 'active',
      })
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppConfigCommands.Update },
      {
        id: 'config-1',
        dto: { manifest: { schemaVersion: 1 } },
        context: resolvedContext,
      }
    );
  });

  it.each([
    ['missing app', 404, 'No app instance exists'],
    ['foreign workspace', 403, 'foreign workspace'],
    ['wrong scope', 403, 'wrong app scope'],
    ['inactive app', 403, 'app inactive'],
    ['inactive membership', 403, 'membership inactive'],
    ['insufficient role', 403, 'owner membership required'],
  ])(
    'maps serialized app context denial to HTTP %s (%s)',
    async (_case, statusCode, message) => {
      const error = { statusCode, message };
      const client = createClient(resolvedContext, error);
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        client as any
      );

      await expect(invokeGetAll(appConfigController)).rejects.toMatchObject({
        status: statusCode,
        response: message,
      });
      expect(client.send).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['admin', 'moderator', 'member'] as const)(
    'does not allow a %s app membership to publish',
    async (membershipRole) => {
      const client = createClient({ ...resolvedContext, membershipRole });
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        client as any
      );

      await expect(
        appConfigController.publishConfiguration(
          'config-1',
          { releaseNotes: 'Not allowed', expectedRevision: 7 },
          user,
          'business-site',
          request
        )
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          message:
            'An active owner membership is required for this app configuration',
        }),
      });
      expect(client.send).toHaveBeenCalledTimes(1);
    }
  );

  it('composes the workspace guard with read and publish and forwards the guarded context', async () => {
    const published = {
      id: 'config-1',
      workspaceId: workspace.workspaceId,
      appInstanceId: resolvedContext.appInstanceId,
      appScope: resolvedContext.appScope,
      revision: 8,
      release: { status: 'published', publishedVersion: 3, history: [] },
    };
    const client = {
      send: jest.fn((command: { cmd: string }) => {
        if (command.cmd === 'app-config.resolveContext')
          return of(resolvedContext);
        if (command.cmd === AppConfigCommands.Publish) return of(published);
        return of([published]);
      }),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );
    const guardedRequest: any = {
      headers: { 'x-ot-appscope': 'business-site' },
      query: { workspaceSlug: workspace.slug },
    };
    const guard = new WorkspaceContextGuard(
      {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue(
            Reflect.getMetadata(
              WORKSPACE_CONTEXT_KEY,
              controller.getAllConfigurations as unknown as Function
            )
          ),
      } as unknown as Reflector,
      {
        resolveContext: jest.fn().mockResolvedValue({
          workspace,
          workspaceScope: `workspace:${workspace.workspaceId}`,
        }),
      } as any,
      { send: jest.fn() } as any
    );
    const executionContext = {
      getHandler: () => controller.getAllConfigurations,
      getClass: () => AppConfigController,
      switchToHttp: () => ({ getRequest: () => guardedRequest }),
    } as any;

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    await expect(
      (appConfigController as any).getAllConfigurations(
        user,
        'business-site',
        guardedRequest
      )
    ).resolves.toEqual([published]);
    await expect(
      appConfigController.publishConfiguration(
        'config-1',
        { releaseNotes: 'Ready', expectedRevision: 7 },
        user,
        'business-site',
        guardedRequest
      )
    ).resolves.toBe(published);

    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppConfigCommands.GetAll },
      { context: resolvedContext }
    );
    expect(client.send).toHaveBeenNthCalledWith(
      4,
      { cmd: AppConfigCommands.Publish },
      expect.objectContaining({ context: resolvedContext })
    );
  });

  describe('published resource ownership preflight', () => {
    const publishedDraft = {
      id: 'config-1',
      workspaceId: workspace.workspaceId,
      appInstanceId: resolvedContext.appInstanceId,
      appScope: resolvedContext.appScope,
      revision: 8,
      manifest: {
        schemaVersion: 1,
        surfaceType: 'generic',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
          },
        },
      },
      release: { status: 'published', publishedVersion: 1, history: [] },
    };

    function createPublishingController(
      catalogs: unknown[],
      options: { rollback?: boolean; serviceError?: Error } = {}
    ) {
      const appClient = {
        send: jest.fn((command: { cmd: string }) => {
          if (command.cmd === AppConfigCommands.Get) return of(publishedDraft);
          if (command.cmd === AppConfigCommands.Publish && !options.rollback) {
            return of(publishedDraft);
          }
          if (command.cmd === AppConfigCommands.Rollback && options.rollback) {
            return of(publishedDraft);
          }
          return of(publishedDraft);
        }),
      };
      const blogClient = {
        send: jest.fn(() =>
          options.serviceError
            ? throwError(() => options.serviceError)
            : of(catalogs)
        ),
      };
      return {
        controller: new AppConfigController(
          { log: jest.fn() } as any,
          appClient as any,
          blogClient as any
        ),
        appClient,
        blogClient,
      };
    }

    it('validates a Blogging resource against the resolved owner/workspace/app scope before publish', async () => {
      const { controller, blogClient, appClient } = createPublishingController([
        { id: 'catalog-1' },
      ]);

      await controller.publishConfiguration(
        'config-1',
        { expectedRevision: 8, releaseNotes: 'Publish' },
        user,
        'business-site',
        request
      );

      expect(blogClient.send).toHaveBeenCalledWith(
        { cmd: 'blogCatalog.findAll' },
        expect.objectContaining({
          ownerId: user.profileId,
          workspaceId: workspace.workspaceId,
          appScope: 'business-site',
        })
      );
      expect(appClient.send).toHaveBeenCalledWith(
        { cmd: AppConfigCommands.Publish },
        expect.anything()
      );
    });

    it.each([
      ['foreign catalog', [{ id: 'catalog-other' }]],
      ['missing catalog', []],
    ])(
      'fails closed for a %s without calling publish',
      async (_name, catalogs) => {
        const { controller, appClient } = createPublishingController(catalogs);

        await expect(
          controller.publishConfiguration(
            'config-1',
            { expectedRevision: 8, releaseNotes: 'Publish' },
            user,
            'business-site',
            request
          )
        ).rejects.toMatchObject({ status: 403 });

        expect(
          appClient.send.mock.calls.some(
            ([command]) => command.cmd === AppConfigCommands.Publish
          )
        ).toBe(false);
      }
    );

    it('does not mutate when the owning Blog service is unavailable', async () => {
      const { controller, appClient } = createPublishingController([], {
        serviceError: new Error('blogging unavailable'),
      });

      await expect(
        controller.publishConfiguration(
          'config-1',
          { expectedRevision: 8, releaseNotes: 'Publish' },
          user,
          'business-site',
          request
        )
      ).rejects.toMatchObject({ status: 503 });
      expect(
        appClient.send.mock.calls.some(
          ([command]) => command.cmd === AppConfigCommands.Publish
        )
      ).toBe(false);
    });

    it('validates the selected rollback snapshot before mutation', async () => {
      const rollbackSnapshot = {
        ...publishedDraft,
        manifest: {
          ...publishedDraft.manifest,
          capabilities: {
            'blogging.posts': {
              enabled: true,
              placement: 'public-content',
              resourceRef: { type: 'blog-catalog', id: 'catalog-rollback' },
            },
          },
        },
      };
      const { controller, appClient, blogClient } = createPublishingController(
        [{ id: 'catalog-other' }],
        { rollback: true }
      );
      appClient.send.mockImplementation((command: { cmd: string }) =>
        command.cmd === AppConfigCommands.Get
          ? of({
              ...publishedDraft,
              release: {
                ...publishedDraft.release,
                history: [{ version: 1, snapshot: rollbackSnapshot }],
              },
            })
          : of(publishedDraft)
      );

      await expect(
        controller.rollbackConfiguration(
          'config-1',
          { expectedRevision: 8, version: 1, releaseNotes: 'Rollback' },
          user,
          'business-site',
          request
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(blogClient.send).toHaveBeenCalled();
      expect(
        appClient.send.mock.calls.some(
          ([command]) => command.cmd === AppConfigCommands.Rollback
        )
      ).toBe(false);
    });
  });

  it.each([
    ['missing workspaceSlug', { query: {} }, undefined],
    [
      'foreign workspaceSlug',
      { query: { workspaceSlug: 'foreign' } },
      new NotFoundException('Workspace was not found'),
    ],
    [
      'wrong-scope workspaceSlug',
      { query: { workspaceSlug: 'north-star' } },
      new ForbiddenException('Workspace does not belong to this app scope'),
    ],
  ] as const)(
    'stops %s before any app-config downstream command',
    async (_label, requestShape, resolverError) => {
      const appConfigClient = { send: jest.fn() };
      const resolver = resolverError
        ? { resolveContext: jest.fn().mockRejectedValue(resolverError) }
        : { resolveContext: jest.fn() };
      const guard = new WorkspaceContextGuard(
        {
          getAllAndOverride: jest
            .fn()
            .mockReturnValue(
              Reflect.getMetadata(
                WORKSPACE_CONTEXT_KEY,
                controller.getAllConfigurations as unknown as Function
              )
            ),
        } as unknown as Reflector,
        resolver as any,
        { send: jest.fn() } as any
      );
      const guardedRequest = {
        headers: { 'x-ot-appscope': 'business-site' },
        ...requestShape,
      } as any;

      await expect(
        guard.canActivate({
          getHandler: () => controller.getAllConfigurations,
          getClass: () => AppConfigController,
          switchToHttp: () => ({ getRequest: () => guardedRequest }),
        } as any)
      ).rejects.toBeInstanceOf(
        resolverError ? resolverError.constructor : BadRequestException
      );
      expect(appConfigClient.send).not.toHaveBeenCalled();
      expect(resolver.resolveContext).toHaveBeenCalledTimes(
        resolverError instanceof NotFoundException ? 2 : resolverError ? 1 : 0
      );
    }
  );

  it.each([
    ['missing workspaceSlug', { query: {} }, undefined],
    [
      'foreign workspaceSlug',
      { query: { workspaceSlug: 'foreign' } },
      new NotFoundException('Workspace was not found'),
    ],
    [
      'wrong-scope workspaceSlug',
      { query: { workspaceSlug: 'north-star' } },
      new ForbiddenException('Workspace does not belong to this app scope'),
    ],
  ] as const)(
    'stops %s before sending an app-config Publish command',
    async (_label, requestShape, resolverError) => {
      const appConfigClient = {
        send: jest.fn().mockReturnValue(of({})),
      };
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        appConfigClient as any
      );
      const publishHandler = jest.spyOn(
        appConfigController,
        'publishConfiguration'
      );
      const resolver = resolverError
        ? { resolveContext: jest.fn().mockRejectedValue(resolverError) }
        : { resolveContext: jest.fn() };
      const guard = new WorkspaceContextGuard(
        {
          getAllAndOverride: jest
            .fn()
            .mockReturnValue(
              Reflect.getMetadata(
                WORKSPACE_CONTEXT_KEY,
                controller.publishConfiguration as unknown as Function
              )
            ),
        } as unknown as Reflector,
        resolver as any,
        { send: jest.fn() } as any
      );
      const guardedRequest = {
        headers: { 'x-ot-appscope': 'business-site' },
        ...requestShape,
      } as any;
      const executePublishPipeline = async () => {
        const allowed = await guard.canActivate({
          getHandler: () => controller.publishConfiguration,
          getClass: () => AppConfigController,
          switchToHttp: () => ({ getRequest: () => guardedRequest }),
        } as any);
        if (!allowed) return undefined;
        return appConfigController.publishConfiguration(
          'config-1',
          { releaseNotes: 'must not publish', expectedRevision: 1 },
          user,
          'business-site',
          guardedRequest
        );
      };

      await expect(executePublishPipeline()).rejects.toBeInstanceOf(
        resolverError ? resolverError.constructor : BadRequestException
      );
      expect(publishHandler).not.toHaveBeenCalled();
      expect(appConfigClient.send).not.toHaveBeenCalledWith(
        { cmd: AppConfigCommands.Publish },
        expect.anything()
      );
    }
  );

  it('maps a protected configuration read denial instead of leaking it as a 500', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of(resolvedContext)
          : throwError(() => ({
              statusCode: 403,
              message: 'Configuration does not belong to the request context',
            }))
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(invokeGetAll(appConfigController)).rejects.toMatchObject({
      status: 403,
      response: 'Configuration does not belong to the request context',
    });
  });

  it('maps a nested serialized RpcException status from context resolution', async () => {
    const client = {
      send: jest.fn(() =>
        throwError(
          () =>
            new RpcException({
              error: {
                statusCode: 400,
                message: 'workspaceId must be a valid UUID',
              },
            })
        )
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(invokeGetAll(appConfigController)).rejects.toMatchObject({
      status: 400,
      response: 'workspaceId must be a valid UUID',
    });
  });

  it('forwards an update revision precondition unchanged', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );
    const manifest = {
      schemaVersion: 1 as const,
      surfaceType: 'business-site' as const,
      capabilities: { blogging: { enabled: true } },
    };

    await appConfigController.updateConfiguration(
      'config-1',
      { manifest, expectedRevision: 7 },
      user,
      'business-site',
      request
    );

    expect(client.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.Update },
      {
        id: 'config-1',
        dto: { manifest, expectedRevision: 7 },
        context: resolvedContext,
      }
    );
  });

  it('forwards a publish revision precondition unchanged', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of(resolvedContext)
          : of({
              id: 'config-1',
              workspaceId: workspace.workspaceId,
              appInstanceId: resolvedContext.appInstanceId,
              appScope: resolvedContext.appScope,
              revision: 8,
              release: {
                status: 'published',
                publishedVersion: 3,
                history: [],
              },
            })
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await appConfigController.publishConfiguration(
      'config-1',
      { releaseNotes: 'Ready', expectedRevision: 7 },
      user,
      'business-site',
      request
    );

    expect(client.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.Publish },
      expect.objectContaining({
        id: 'config-1',
        dto: { releaseNotes: 'Ready', expectedRevision: 7 },
      })
    );
  });

  it('returns the server-confirmed publish revision and release state unchanged', async () => {
    const published = {
      id: 'config-1',
      workspaceId: workspace.workspaceId,
      appInstanceId: resolvedContext.appInstanceId,
      appScope: resolvedContext.appScope,
      revision: 8,
      release: {
        status: 'published',
        publishedVersion: 3,
        publishedAt: '2026-08-31T20:00:00.000Z',
      },
    };
    const client = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of(resolvedContext)
          : of(published)
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(
      appConfigController.publishConfiguration(
        'config-1',
        { releaseNotes: 'Ready', expectedRevision: 7 },
        user,
        'business-site',
        request
      )
    ).resolves.toBe(published);
  });

  it.each([
    ['id', { id: 'foreign-config' }],
    ['workspace', { workspaceId: 'foreign-workspace' }],
    ['app instance', { appInstanceId: 'foreign-app-instance' }],
    ['app scope', { appScope: 'foreign-scope' }],
    ['revision', { revision: undefined }],
    ['release', { release: undefined }],
  ])(
    'rejects a publish response with a mismatched %s',
    async (_field, override) => {
      const client = {
        send: jest.fn((command: { cmd: string }) =>
          command.cmd === 'app-config.resolveContext'
            ? of(resolvedContext)
            : of({
                id: 'config-1',
                workspaceId: workspace.workspaceId,
                appInstanceId: resolvedContext.appInstanceId,
                appScope: resolvedContext.appScope,
                revision: 8,
                release: {
                  status: 'published',
                  publishedVersion: 3,
                  history: [],
                },
                ...override,
              })
        ),
      };
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        client as any
      );

      await expect(
        appConfigController.publishConfiguration(
          'config-1',
          { releaseNotes: 'Ready', expectedRevision: 7 },
          user,
          'business-site',
          request
        )
      ).rejects.toMatchObject({
        status: 503,
        response: expect.objectContaining({
          message: expect.stringContaining('publish response'),
        }),
      });
    }
  );

  it('maps an app-configurator revision conflict to HTTP 409', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of(resolvedContext)
          : throwError(() => ({
              statusCode: 409,
              message: 'Configuration changed elsewhere.',
            }))
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(
      appConfigController.publishConfiguration(
        'config-1',
        { releaseNotes: 'Ready', expectedRevision: 7 },
        user,
        'business-site',
        request
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('validates rollback responses against the resolved owner scope', async () => {
    const client = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of(resolvedContext)
          : of({
              id: 'config-1',
              workspaceId: workspace.workspaceId,
              appInstanceId: resolvedContext.appInstanceId,
              appScope: 'foreign-scope',
              revision: 9,
              release: {
                status: 'published',
                publishedVersion: 4,
                history: [],
              },
            })
      ),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await expect(
      appConfigController.rollbackConfiguration(
        'config-1',
        { version: 1, releaseNotes: 'Restore', expectedRevision: 8 },
        user,
        'business-site',
        request
      )
    ).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        message: expect.stringContaining('rollback response'),
      }),
    });
  });

  it('forwards anonymous discovery and preserves the public query contract', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );

    await appConfigController.discoverPublishedApps('north', 'joinable', null);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.DiscoverPublishedApps },
      {
        identity: null,
        query: { search: 'north', accessPolicy: 'joinable' },
      }
    );
  });

  it('binds membership mutations to the authenticated user/profile identity', async () => {
    const client = createClient();
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );
    const verifiedUser = { ...user, emailVerified: true };

    await appConfigController.joinPublishedApp('app-1', verifiedUser);
    await appConfigController.requestPublishedApp('app-2', verifiedUser);

    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: AppConfigCommands.JoinPublishedApp },
      {
        id: 'app-1',
        identity: { userId: user.userId, profileId: user.profileId },
      }
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppConfigCommands.RequestPublishedApp },
      {
        id: 'app-2',
        identity: { userId: user.userId, profileId: user.profileId },
      }
    );
  });

  it.each([
    ['join an app', 'joinPublishedApp'],
    ['request app access', 'requestPublishedApp'],
  ] as const)(
    'rejects an authenticated but unverified account when attempting to %s',
    async (_action, methodName) => {
      const client = createClient();
      const appConfigController = new AppConfigController(
        { log: jest.fn() } as any,
        client as any
      );

      await expect(
        appConfigController[methodName]('app-1', {
          ...user,
          emailVerified: false,
        })
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: {
          message:
            'Email verification is required before joining or requesting app access',
        },
      });
      expect(client.send).not.toHaveBeenCalled();
    }
  );
});
