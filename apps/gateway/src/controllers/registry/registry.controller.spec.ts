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
    const response = controller.getApps();

    expect(response.success).toBe(true);
    expect(response.data.apps.map((app) => app.appId)).toContain('hai');
    expect(response.data.apps.map((app) => app.appId)).toContain(
      'system-configurator'
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
