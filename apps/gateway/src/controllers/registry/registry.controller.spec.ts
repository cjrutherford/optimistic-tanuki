import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, of, throwError } from 'rxjs';
import {
  AppRegistry,
  DEFAULT_APP_REGISTRY,
  DEFAULT_NAVIGATION_LINKS,
  NavigationLink,
  RegistryReleaseBundle,
  RegistrySourceSnapshot,
} from '@optimistic-tanuki/app-registry-backend';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { UserDetails } from '../../decorators/user.decorator';
import { RegistryController } from './registry.controller';

interface SentCommand {
  cmd: string;
  payload: Record<string, unknown>;
}

/** Stands in for the app-configurator registry commands. */
class FakeRegistryClient implements Pick<ClientProxy, 'send'> {
  down = false;
  failWith: unknown = null;
  sent: SentCommand[] = [];
  bundle: RegistryReleaseBundle | null = null;
  seeds = 0;

  constructor(private readonly source: RegistrySourceSnapshot) {}

  send<T>(pattern: { cmd: string }, payload: unknown): Observable<T> {
    this.sent.push({
      cmd: pattern.cmd,
      payload: payload as Record<string, unknown>,
    });
    if (this.down) {
      return throwError(() => new Error('connect ECONNREFUSED'));
    }
    if (this.failWith) {
      return throwError(() => this.failWith);
    }
    return of(this.handle(pattern.cmd, payload as never) as T);
  }

  private handle(cmd: string, payload: Record<string, unknown>): unknown {
    switch (cmd) {
      case AppConfigCommands.RegistrySeed:
        this.seeds += 1;
        this.bundle ??= this.make(this.source.registry, this.source.links, 1);
        return { seeded: true, version: 1 };
      case AppConfigCommands.RegistryGet:
        return this.bundle;
      case AppConfigCommands.RegistrySaveDraft: {
        const registry =
          (payload['registry'] as AppRegistry) ?? this.bundle?.registry;
        const links =
          (payload['links'] as NavigationLink[]) ?? this.bundle?.links;
        this.bundle = this.make(registry as AppRegistry, links ?? [], 1);
        return this.bundle;
      }
      case AppConfigCommands.RegistryPublish:
      case AppConfigCommands.RegistryRollback:
        return this.bundle;
      case AppConfigCommands.RegistryAuditList:
        return [{ id: 1, event: 'seed', actor: 'yaml-seed' }];
      case AppConfigCommands.RegistryDrift:
        return { state: 'in-sync' };
      case AppConfigCommands.RegistryExportYaml:
        return { yaml: 'version: 1', diff: '', identical: true };
      default:
        return null;
    }
  }

  private make(
    registry: AppRegistry,
    links: NavigationLink[],
    version: number
  ): RegistryReleaseBundle {
    return {
      registry,
      links,
      release: { status: 'published', publishedVersion: version, history: [] },
    };
  }
}

const owner = { email: 'owner@example.com', userId: 'u-1' } as UserDetails;

describe('RegistryController', () => {
  let client: FakeRegistryClient;
  let controller: RegistryController;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    const source = {
      registry: DEFAULT_APP_REGISTRY,
      links: DEFAULT_NAVIGATION_LINKS,
    };
    client = new FakeRegistryClient(source);
    controller = new RegistryController(
      DEFAULT_APP_REGISTRY,
      DEFAULT_NAVIGATION_LINKS,
      client as unknown as ClientProxy
    );
    warn = jest
      .spyOn(
        (controller as unknown as { logger: { warn: () => void } }).logger,
        'warn'
      )
      .mockImplementation(() => undefined);
  });

  const sentCmds = () => client.sent.map((entry) => entry.cmd);

  describe('public reads', () => {
    it('keeps the response contract and cache headers', async () => {
      const headers = { setHeader: jest.fn() };
      const response = await controller.getApps(headers);

      expect(response.success).toBe(true);
      expect(response.data.apps.map((app) => app.appId)).toContain('hai');
      expect(response.release.status).toBe('published');
      expect(response.origin).toBe('database');
      expect(headers.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=60, stale-while-revalidate=300'
      );
      expect(headers.setHeader).toHaveBeenCalledWith(
        'X-App-Registry-Version',
        DEFAULT_APP_REGISTRY.version
      );
      expect(headers.setHeader).toHaveBeenCalledWith(
        'ETag',
        `W/"app-registry-${DEFAULT_APP_REGISTRY.version}-${DEFAULT_APP_REGISTRY.generatedAt}"`
      );
    });

    it('seeds from the deployed YAML once, then reads', async () => {
      await controller.getApps();
      await controller.getApps();
      expect(client.seeds).toBe(1);
      expect(client.sent[0]).toEqual({
        cmd: AppConfigCommands.RegistrySeed,
        payload: {
          source: {
            registry: DEFAULT_APP_REGISTRY,
            links: DEFAULT_NAVIGATION_LINKS,
          },
        },
      });
    });

    it('returns a single app, links and links by source app', async () => {
      expect((await controller.getApp('system-configurator')).data.appId).toBe(
        'system-configurator'
      );
      expect(
        (await controller.getLinks()).data.map((link) => link.linkId)
      ).toContain('hai-to-configurator');
      expect(
        (await controller.getLinksForApp('hai')).data.every(
          (link) => link.sourceAppId === 'hai'
        )
      ).toBe(true);
    });

    it('throws not found for unknown apps', async () => {
      await expect(controller.getApp('missing-app')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('when the registry service is down', () => {
    beforeEach(() => {
      client.down = true;
    });

    it('serves the deployed YAML registry and logs a warning', async () => {
      const response = await controller.getApps({ setHeader: jest.fn() });

      expect(response.origin).toBe('yaml-fallback');
      expect(response.data.apps).toEqual(DEFAULT_APP_REGISTRY.apps);
      expect(response.release.history).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('deployed YAML registry')
      );
      expect((await controller.getLinks()).data).toEqual(
        DEFAULT_NAVIGATION_LINKS
      );
    });

    it('prefers the last good copy once it has one', async () => {
      client.down = false;
      await controller.getApps();
      client.down = true;

      const response = await controller.getApps();

      expect(response.origin).toBe('cache');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('last known registry')
      );
    });

    it('refuses writes with 503 instead of pretending they worked', async () => {
      await expect(
        controller.updateApps({ registry: DEFAULT_APP_REGISTRY }, owner)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        controller.publishRegistry({ releaseNotes: 'x' }, owner)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        controller.rollbackRegistry({ version: 1, releaseNotes: 'x' }, owner)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('mutations', () => {
    it('saves a draft with the acting owner and returns the release', async () => {
      const next = { ...DEFAULT_APP_REGISTRY, version: '1.0.1' };
      const response = await controller.updateApps({ registry: next }, owner);

      expect(response.success).toBe(true);
      expect(response.data.version).toBe('1.0.1');
      expect(response.release).toBeDefined();
      const save = client.sent.find(
        (entry) => entry.cmd === AppConfigCommands.RegistrySaveDraft
      );
      expect(save?.payload['actor']).toBe('owner@example.com');
    });

    it('sends the reason, notes and deployed source on publish', async () => {
      const response = await controller.publishRegistry(
        {
          releaseNotes: 'Registry launch.',
          changeSummary: 'Stabilised.',
          reason: 'owner asked',
        },
        owner
      );

      expect(response.success).toBe(true);
      const publish = client.sent.find(
        (entry) => entry.cmd === AppConfigCommands.RegistryPublish
      );
      expect(publish?.payload).toMatchObject({
        actor: 'owner@example.com',
        releaseNotes: 'Registry launch.',
        reason: 'owner asked',
        source: { registry: DEFAULT_APP_REGISTRY },
      });
    });

    it('requires release notes', async () => {
      await expect(
        controller.publishRegistry({ releaseNotes: '  ' }, owner)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(sentCmds()).not.toContain(AppConfigCommands.RegistryPublish);
    });

    it('sends the rollback reason', async () => {
      await controller.rollbackRegistry(
        { version: 1, releaseNotes: 'notes', reason: 'bad release' },
        owner
      );
      const rollback = client.sent.find(
        (entry) => entry.cmd === AppConfigCommands.RegistryRollback
      );
      expect(rollback?.payload).toMatchObject({
        version: 1,
        reason: 'bad release',
        actor: 'owner@example.com',
      });
    });

    it('passes a service 4xx through as the same HTTP status', async () => {
      await controller.getApps();
      client.failWith = { statusCode: 404, message: 'release 9 not found' };
      const error = await controller
        .rollbackRegistry({ version: 9, releaseNotes: 'x' }, owner)
        .catch((e: HttpException) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    });

    it('rejects invalid registries before calling the service', async () => {
      const bad = [
        { apps: [DEFAULT_APP_REGISTRY.apps[0], DEFAULT_APP_REGISTRY.apps[0]] },
        { apps: [{ ...DEFAULT_APP_REGISTRY.apps[0], domain: 'not a domain' }] },
        {
          apps: [
            {
              ...DEFAULT_APP_REGISTRY.apps[0],
              uiBaseUrl: 'https://store.example.com',
            },
          ],
        },
        {
          apps: [{ ...DEFAULT_APP_REGISTRY.apps[0], iconUrl: '/logo.png' }],
        },
      ];
      for (const registry of bad) {
        await expect(
          controller.updateApps(
            { registry: { ...DEFAULT_APP_REGISTRY, ...registry } },
            owner
          )
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(sentCmds()).not.toContain(AppConfigCommands.RegistrySaveDraft);
    });

    it('saves links for registered apps and rejects unknown ones', async () => {
      const response = await controller.updateLinks(
        {
          links: [
            {
              linkId: 'hai-to-store',
              sourceAppId: 'hai',
              targetAppId: 'store',
              type: 'footer',
              label: 'Store',
              position: 'footer',
            },
          ],
        },
        owner
      );
      expect(response.data).toHaveLength(1);

      await expect(
        controller.updateLinks(
          {
            links: [
              {
                linkId: 'bad',
                sourceAppId: 'hai',
                targetAppId: 'missing-app',
                type: 'nav',
                label: 'Missing',
              },
            ],
          },
          owner
        )
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.updateLinks({ links: undefined as never }, owner)
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('owner endpoints', () => {
    it('reads the audit log, drift and export through the service', async () => {
      expect((await controller.getAuditLog()).data[0]).toMatchObject({
        actor: 'yaml-seed',
      });
      expect((await controller.getDrift()).data.state).toBe('in-sync');
      expect((await controller.exportYaml()).data.identical).toBe(true);
    });
  });

  describe('guards', () => {
    const protectedRoutes: (keyof RegistryController)[] = [
      'updateApps',
      'updateLinks',
      'publishRegistry',
      'rollbackRegistry',
      'getAuditLog',
      'getDrift',
      'exportYaml',
    ];

    it.each(protectedRoutes)('%s requires registry.manage', (route) => {
      const handler = RegistryController.prototype[route] as () => unknown;
      expect(Reflect.getMetadata('__guards__', handler)).toHaveLength(2);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual({
        permissions: ['registry.manage'],
      });
    });

    it.each(['getApps', 'getApp', 'getLinks', 'getLinksForApp'] as const)(
      '%s stays public',
      (route) => {
        const handler = RegistryController.prototype[route] as () => unknown;
        expect(Reflect.getMetadata('__guards__', handler)).toBeUndefined();
      }
    );
  });
});
