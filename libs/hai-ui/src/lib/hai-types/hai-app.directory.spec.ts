import {
  HAI_APP_DIRECTORY,
  HAI_APP_STATUS_LABELS,
  resolveHaiAppLinks,
} from './hai-app.directory';

describe('HAI app directory', () => {
  it('lists the curated HAI offerings', () => {
    expect(HAI_APP_DIRECTORY.map((app) => app.name)).toEqual([
      'Optimistic Tanuki',
      'Towne Square',
      'Forge of Will',
      'Fin Commander',
      'Opportunity Compass',
      'Developer Portal',
      'Store',
      'Video Platform',
      'Homestead',
      'Statocyst',
    ]);
  });

  it('leaves out products that are in development but paused', () => {
    const names = HAI_APP_DIRECTORY.map((app) => app.name);

    expect(names).not.toContain('Jellyfin Harbor');
    expect(names).not.toContain('PXE');
  });

  it('lists Homestead and Statocyst in development, with no invented link', () => {
    const separate = HAI_APP_DIRECTORY.filter((app) =>
      ['Homestead', 'Statocyst'].includes(app.name)
    );

    expect(separate).toHaveLength(2);
    for (const app of separate) {
      expect(app.status).toBe('in-development');
      expect(app.repositoryUrl).toBeUndefined();
    }
    const links = resolveHaiAppLinks([]);
    expect(
      links
        .filter((link) => ['Homestead', 'Statocyst'].includes(link.name))
        .map((link) => link.resolvedHref)
    ).toEqual([undefined, undefined]);
  });

  it('resolves registered apps as public links with absolute icon urls', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'local-hub',
        name: 'Towne Square',
        domain: 'localhost',
        uiBaseUrl: 'https://towne-square.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
        iconUrl: 'https://towne-square.example.com/assets/ts.png',
      },
    ]);

    expect(links.find((link) => link.appId === 'towne-square')).toMatchObject({
      resolvedHref: 'https://towne-square.example.com',
      runUrl: 'https://towne-square.example.com',
      logoSrc: 'https://towne-square.example.com/assets/ts.png',
      isPublic: true,
    });
  });

  it('exposes the running app url separately from the repository url', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'local-hub',
        name: 'Towne Square',
        domain: 'localhost',
        uiBaseUrl: 'https://towne-square.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
      },
    ]);

    const towneSquare = links.find((link) => link.appId === 'towne-square');
    expect(towneSquare?.runUrl).toBe('https://towne-square.example.com');
    expect(towneSquare?.repositoryUrl).toContain('/apps/local-hub');

    const repositoryOnly = links.find((link) => link.appId === 'fin-commander');
    expect(repositoryOnly?.runUrl).toBeUndefined();
    expect(repositoryOnly?.isPublic).toBe(false);
  });

  it('maps curated entries to registry app ids instead of project names', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'store',
        name: 'HAI Store',
        domain: 'localhost',
        uiBaseUrl: 'https://store.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
        iconUrl: 'https://store.example.com/assets/store-icon.png',
      },
      {
        appId: 'opportunity-compass',
        name: 'Opportunity Compass',
        domain: 'localhost',
        uiBaseUrl: 'https://opportunities.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
        iconUrl: 'https://opportunities.example.com/favicon.ico',
      },
      {
        appId: 'video-platform',
        name: 'Video Platform',
        domain: 'localhost',
        uiBaseUrl: 'https://video.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
        iconUrl: 'https://video.example.com/android-chrome-192x192.png',
      },
    ]);

    expect(links.find((link) => link.appId === 'store-client')).toMatchObject({
      resolvedHref: 'https://store.example.com',
      logoSrc: 'https://store.example.com/assets/store-icon.png',
      isPublic: true,
    });
    expect(
      links.find((link) => link.appId === 'opportunity-compass')
    ).toMatchObject({
      resolvedHref: 'https://opportunities.example.com',
      logoSrc: 'https://opportunities.example.com/favicon.ico',
      isPublic: true,
    });
    expect(links.find((link) => link.appId === 'video-platform')).toMatchObject(
      {
        resolvedHref: 'https://video.example.com',
        logoSrc: 'https://video.example.com/android-chrome-192x192.png',
        isPublic: true,
      }
    );
  });

  it('falls back to the app repository when the registry entry is missing', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'fin-commander',
        name: 'Fin Commander',
        domain: 'localhost',
        uiBaseUrl: 'https://finance.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
      },
    ]);

    expect(links.find((link) => link.appId === 'fin-commander')).toMatchObject({
      resolvedHref: 'https://finance.example.com',
      isPublic: true,
    });
    expect(
      links.find((link) => link.appId === 'opportunity-compass')?.resolvedHref
    ).toContain('/apps/leads-app');
  });

  it('does not invent a logo path when the registry icon is missing', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'local-hub',
        name: 'Towne Square',
        domain: 'localhost',
        uiBaseUrl: 'https://towne-square.example.com',
        apiBaseUrl: 'https://api.example.com',
        appType: 'client',
        visibility: 'public',
      },
    ]);

    expect(links.find((link) => link.appId === 'towne-square')).toMatchObject({
      logoSrc: undefined,
      resolvedHref: 'https://towne-square.example.com',
      isPublic: true,
    });
  });

  it('falls back to the app repository when the app is not in the registry', () => {
    const links = resolveHaiAppLinks([]);

    expect(links.find((link) => link.appId === 'fin-commander')).toMatchObject({
      resolvedHref:
        'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/fin-commander',
      isPublic: false,
      runUrl: undefined,
    });
  });

  it('excludes the current app from resolved directory results', () => {
    const links = resolveHaiAppLinks([], 'opportunity-compass');

    expect(links.some((link) => link.appId === 'opportunity-compass')).toBe(
      false
    );
  });

  it('excludes the current app when callers provide the registry app id', () => {
    const links = resolveHaiAppLinks([], 'client-interface');

    expect(links.some((link) => link.appId === 'optimistic-tanuki')).toBe(
      false
    );
  });
  it.each([
    'javascript:alert(1)',
    '/towne-square',
    'https://user:password@example.com',
    '',
  ])(
    'does not publish unsafe or relative app destinations: %s',
    (uiBaseUrl) => {
      const links = resolveHaiAppLinks([
        {
          appId: 'local-hub',
          name: 'TS',
          domain: '',
          uiBaseUrl,
          apiBaseUrl: '',
          appType: 'client',
          visibility: 'public',
        },
      ]);
      expect(
        links.find((app) => app.appId === 'towne-square')?.runUrl
      ).toBeUndefined();
    }
  );

  it('does not publish internal app destinations', () => {
    const links = resolveHaiAppLinks([
      {
        appId: 'local-hub',
        name: 'TS',
        domain: '',
        uiBaseUrl: 'https://internal.example.com',
        apiBaseUrl: '',
        appType: 'client',
        visibility: 'internal',
      },
    ]);
    expect(
      links.find((app) => app.appId === 'towne-square')?.runUrl
    ).toBeUndefined();
  });

  it('gives every product a lifecycle status with a label', () => {
    for (const app of HAI_APP_DIRECTORY) {
      expect(app.status).toBeDefined();
      expect(HAI_APP_STATUS_LABELS[app.status!]).toBeTruthy();
    }
  });

  it('claims no product is generally available without release evidence', () => {
    expect(HAI_APP_DIRECTORY.map((app) => app.status)).not.toContain(
      'available'
    );
  });

  it('carries the status through to resolved links', () => {
    const [link] = resolveHaiAppLinks([]);

    expect(link.status).toBe('early-access');
  });
});
