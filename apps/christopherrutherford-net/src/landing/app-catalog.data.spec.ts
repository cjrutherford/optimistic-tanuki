import { APP_CATALOG, APP_CATALOG_GROUPS } from './app-catalog.data';
import { PORTFOLIO_ENTRIES } from './portfolio.data';
import {
  AppRegistration,
  DEFAULT_APP_REGISTRY,
} from '@optimistic-tanuki/app-registry-backend';
import { getRegisteredWebAppCatalog } from './app-catalog.data';

describe('the Systems Lab application catalog', () => {
  it('contains every registered web app except the portfolio site exactly once', () => {
    const displayedIds = APP_CATALOG.map((app) => app.registryId).sort();
    const expectedIds = DEFAULT_APP_REGISTRY.apps
      .map((app) => app.appId)
      .filter((id) => id !== 'christopherrutherford-net')
      .sort();

    expect(APP_CATALOG).toHaveLength(18);
    expect(new Set(displayedIds).size).toBe(displayedIds.length);
    expect(displayedIds).toEqual(expectedIds);
    expect(APP_CATALOG.map((app) => app.id)).not.toContain(
      'christopherrutherford-net'
    );
  });

  it('groups registered public apps and internal web tools separately', () => {
    expect(APP_CATALOG_GROUPS.publicApps).toHaveLength(14);
    expect(APP_CATALOG_GROUPS.internalTools).toHaveLength(4);
    expect(
      APP_CATALOG_GROUPS.publicApps.every((app) => app.group === 'publicApps')
    ).toBe(true);
    expect(
      APP_CATALOG_GROUPS.internalTools.map((app) => app.registryId).sort()
    ).toEqual([
      'business-configurator',
      'configurable-client',
      'owner-console',
      'ui-playground',
    ]);
  });

  it('maps registry aliases to their actual Nx web app roots and portfolio cards', () => {
    expect(APP_CATALOG.find((app) => app.registryId === 'store')?.root).toBe(
      'apps/store-client'
    );
    expect(
      APP_CATALOG.find((app) => app.registryId === 'opportunity-compass')?.root
    ).toBe('apps/leads-app');
    expect(
      APP_CATALOG.find((app) => app.registryId === 'video-platform')?.root
    ).toBe('apps/video-client');
    expect(PORTFOLIO_ENTRIES.map((entry) => entry.id).sort()).toEqual(
      APP_CATALOG.map((app) => app.id).sort()
    );
    expect(APP_CATALOG.some((app) => /-service$|-worker$/.test(app.id))).toBe(
      false
    );
  });

  it('follows runtime registry additions and removals while excluding non-web apps and the portfolio', () => {
    const addedPublicApp: AppRegistration = {
      appId: 'new-public-app',
      name: 'New Public App',
      domain: 'new-public-app.example',
      uiBaseUrl: 'https://new-public-app.example',
      apiBaseUrl: 'https://api.example',
      appType: 'client',
      visibility: 'public',
    };
    const addedInternalApp: AppRegistration = {
      ...addedPublicApp,
      appId: 'new-internal-console',
      name: 'New Internal Console',
      appType: 'admin',
      visibility: 'internal',
    };
    const backendRecord: AppRegistration = {
      ...addedPublicApp,
      appId: 'backend-service',
      name: 'Backend Service',
      appType: 'user',
    };
    const noUiRecord: AppRegistration = {
      ...addedPublicApp,
      appId: 'client-without-ui',
      name: 'Client Without UI',
      uiBaseUrl: '',
    };
    const runtimeEntries = getRegisteredWebAppCatalog([
      ...DEFAULT_APP_REGISTRY.apps
        .filter(
          (app) =>
            app.appId !== 'hai' && app.appId !== 'christopherrutherford-net'
        )
        .map((app) =>
          app.appId === 'local-hub'
            ? { ...app, visibility: 'internal' as const }
            : app
        ),
      addedPublicApp,
      addedInternalApp,
      backendRecord,
      noUiRecord,
    ]);

    expect(runtimeEntries.map((entry) => entry.registryId)).not.toContain(
      'hai'
    );
    expect(runtimeEntries.map((entry) => entry.registryId)).not.toContain(
      'christopherrutherford-net'
    );
    expect(runtimeEntries.map((entry) => entry.registryId)).not.toContain(
      'backend-service'
    );
    expect(runtimeEntries.map((entry) => entry.registryId)).not.toContain(
      'client-without-ui'
    );
    expect(
      runtimeEntries.find((entry) => entry.registryId === 'new-public-app')
    ).toMatchObject({
      id: 'new-public-app',
      group: 'publicApps',
      root: undefined,
      tagline: 'Part of the public app catalog.',
    });
    expect(
      runtimeEntries.find(
        (entry) => entry.registryId === 'new-internal-console'
      )
    ).toMatchObject({
      id: 'new-internal-console',
      group: 'internalTools',
      tagline: 'Part of the internal app catalog.',
    });
    expect(
      runtimeEntries.find((entry) => entry.registryId === 'local-hub')?.group
    ).toBe('internalTools');
  });
});
