import {
  HAI_APP_DIRECTORY,
  resolveHaiAppLinks,
} from './hai-app.directory';

describe('HAI app directory', () => {
  it('lists the five registry-backed HAI offerings', () => {
    expect(HAI_APP_DIRECTORY.map((app) => app.name)).toEqual([
      'Optimistic Tanuki',
      'Towne Square',
      'Forge of Will',
      'Fin Commander',
      'Opportunity Compass',
    ]);
  });

  it('resolves active app-config domains as public links', () => {
    const links = resolveHaiAppLinks([
      {
        name: 'local-hub',
        domain: 'towne-square.example.com',
        active: true,
      },
    ]);

    expect(links.find((link) => link.appId === 'towne-square')).toMatchObject({
      resolvedHref: 'https://towne-square.example.com',
      isPublic: true,
    });
  });

  it('falls back to the app repository when config is private or missing', () => {
    const links = resolveHaiAppLinks([
      {
        name: 'fin-commander',
        domain: 'finance.example.com',
        active: false,
      },
    ]);

    expect(links.find((link) => link.appId === 'fin-commander')).toMatchObject({
      resolvedHref:
        'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/fin-commander',
      isPublic: false,
    });
    expect(
      links.find((link) => link.appId === 'opportunity-compass')?.resolvedHref
    ).toContain('/apps/leads-app');
  });

  it('excludes the current app from resolved directory results', () => {
    const links = resolveHaiAppLinks([], 'opportunity-compass');

    expect(links.some((link) => link.appId === 'opportunity-compass')).toBe(
      false
    );
  });
});
