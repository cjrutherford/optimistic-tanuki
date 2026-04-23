import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { DEFAULT_APP_REGISTRY } from '../../../../../libs/app-registry/src/lib/default-registry';
import { DEFAULT_NAVIGATION_LINKS } from '../../../../../libs/app-registry/src/lib/default-links';

describe('RegistryController', () => {
  let controller: RegistryController;

  beforeEach(() => {
    controller = new RegistryController(
      DEFAULT_APP_REGISTRY,
      DEFAULT_NAVIGATION_LINKS
    );
  });

  it('returns the bundled application registry response', () => {
    const responseHeaders = { setHeader: jest.fn() };
    const response = controller.getApps(responseHeaders as any);

    expect(response.success).toBe(true);
    expect(response.data.apps.map((app) => app.appId)).toContain('hai');
    expect(response.data.apps.map((app) => app.appId)).toContain(
      'system-configurator'
    );
    expect(responseHeaders.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300'
    );
    expect(responseHeaders.setHeader).toHaveBeenCalledWith(
      'X-App-Registry-Version',
      DEFAULT_APP_REGISTRY.version
    );
    expect(responseHeaders.setHeader).toHaveBeenCalledWith(
      'ETag',
      `W/"app-registry-${DEFAULT_APP_REGISTRY.version}"`
    );
  });

  it('uses a passed in registry copy', () => {
    const configured = new RegistryController(
      {
        ...DEFAULT_APP_REGISTRY,
        apps: [
          {
            ...DEFAULT_APP_REGISTRY.apps[0],
            appId: 'configured-hai',
            name: 'Configured HAI',
          },
        ],
      },
      []
    );

    expect(configured.getApps().data.apps.map((app) => app.appId)).toEqual([
      'configured-hai',
    ]);
  });

  it('updates the runtime registry cache through the admin endpoint', () => {
    const nextRegistry = {
      ...DEFAULT_APP_REGISTRY,
      version: '1.0.1',
      apps: [
        ...DEFAULT_APP_REGISTRY.apps,
        {
          ...DEFAULT_APP_REGISTRY.apps[0],
          appId: 'configured-hai',
          name: 'Configured HAI',
        },
      ],
    };

    const response = controller.updateApps({ registry: nextRegistry });

    expect(response.success).toBe(true);
    expect(controller.getApps().data.version).toBe('1.0.1');
    expect(controller.getApp('configured-hai').data.name).toBe(
      'Configured HAI'
    );
  });

  it('records registry updates in the audit log', () => {
    const nextRegistry = {
      ...DEFAULT_APP_REGISTRY,
      version: '1.0.1',
    };

    controller.updateApps({ registry: nextRegistry });

    expect(controller.getAuditLog().data).toEqual([
      expect.objectContaining({
        action: 'apps.updated',
        summary: 'Updated application registry to version 1.0.1',
        metadata: {
          version: '1.0.1',
          appCount: nextRegistry.apps.length,
        },
      }),
    ]);
  });

  it('rejects admin registry updates with duplicate app ids', () => {
    expect(() =>
      controller.updateApps({
        registry: {
          ...DEFAULT_APP_REGISTRY,
          apps: [DEFAULT_APP_REGISTRY.apps[0], DEFAULT_APP_REGISTRY.apps[0]],
        },
      })
    ).toThrow(BadRequestException);
  });

  it('rejects registry apps with invalid domains or UI URLs', () => {
    expect(() =>
      controller.updateApps({
        registry: {
          ...DEFAULT_APP_REGISTRY,
          apps: [
            {
              ...DEFAULT_APP_REGISTRY.apps[0],
              domain: 'not a domain',
            },
          ],
        },
      })
    ).toThrow(BadRequestException);

    expect(() =>
      controller.updateApps({
        registry: {
          ...DEFAULT_APP_REGISTRY,
          apps: [
            {
              ...DEFAULT_APP_REGISTRY.apps[0],
              uiBaseUrl: 'https://store.example.com',
            },
          ],
        },
      })
    ).toThrow(BadRequestException);
  });

  it('does not mutate the passed in navigation link array', () => {
    const links = DEFAULT_NAVIGATION_LINKS.slice(0, 1);
    const configured = new RegistryController(DEFAULT_APP_REGISTRY, links);

    configured.updateLinks({ links: [] });

    expect(links).toHaveLength(1);
    expect(configured.getLinks().data).toEqual([]);
  });

  it('returns a single registered app by id', () => {
    const response = controller.getApp('system-configurator');

    expect(response.success).toBe(true);
    expect(response.data.appId).toBe('system-configurator');
  });

  it('throws not found for unknown apps', () => {
    expect(() => controller.getApp('missing-app')).toThrow(NotFoundException);
  });

  it('returns bundled navigation links', () => {
    const response = controller.getLinks();

    expect(response.success).toBe(true);
    expect(response.data.map((link) => link.linkId)).toContain(
      'hai-to-configurator'
    );
  });

  it('returns navigation links by source app', () => {
    const response = controller.getLinksForApp('hai');

    expect(response.success).toBe(true);
    expect(response.data.every((link) => link.sourceAppId === 'hai')).toBe(
      true
    );
  });

  it('updates navigation links when target apps are registered', () => {
    const response = controller.updateLinks({
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
    });

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(controller.getLinksForApp('hai').data[0].linkId).toBe(
      'hai-to-store'
    );
    expect(controller.getAuditLog().data[0]).toEqual(
      expect.objectContaining({
        action: 'links.updated',
        summary: 'Updated 1 navigation link',
        metadata: { linkCount: 1 },
      })
    );
  });

  it('rejects links with unknown app ids', () => {
    expect(() =>
      controller.updateLinks({
        links: [
          {
            linkId: 'bad-link',
            sourceAppId: 'hai',
            targetAppId: 'missing-app',
            type: 'nav',
            label: 'Missing',
          },
        ],
      })
    ).toThrow(BadRequestException);
  });
});
