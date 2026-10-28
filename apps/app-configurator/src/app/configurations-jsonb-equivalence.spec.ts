import { ConfigurationsService } from './configurations.service';
/** Test the comparison contract independently of repository serialization. The PG fixture proves its real create/publish callers. */
describe('App Configurator JSONB comparison semantics', () => {
  const service = new ConfigurationsService(
    null as never,
    null as never,
    null as never,
    null as never
  ) as unknown as {
    configurationMatchesSeed(left: unknown, right: unknown): boolean;
    snapshotsEqual(left: unknown, right: unknown): boolean;
  };
  const left = {
    name: 'configuration',
    ownerUserId: 'account-a',
    ownerProfileId: 'profile-a',
    landingPage: {
      layout: 'single-column',
      sections: [
        { id: 'first', type: 'hero' },
        { id: 'second', type: 'text' },
      ],
    },
    manifest: {
      schemaVersion: 1,
      surfaceType: 'community',
      capabilities: { 'forum.discussions': { enabled: true } },
    },
  };
  it('accepts PostgreSQL reordered object keys at every nested level', () => {
    const right = {
      ...left,
      landingPage: {
        sections: [
          { type: 'hero', id: 'first' },
          { type: 'text', id: 'second' },
        ],
        layout: 'single-column',
      },
      manifest: {
        capabilities: { 'forum.discussions': { enabled: true } },
        surfaceType: 'community',
        schemaVersion: 1,
      },
    };
    expect(service.configurationMatchesSeed(left, right)).toBe(true);
    expect(service.snapshotsEqual(left, right)).toBe(true);
  });
  it('preserves array order and actual content changes', () => {
    expect(
      service.configurationMatchesSeed(left, {
        ...left,
        landingPage: {
          ...left.landingPage,
          sections: [...left.landingPage.sections].reverse(),
        },
      })
    ).toBe(false);
    expect(
      service.snapshotsEqual(left, {
        ...left,
        manifest: { ...left.manifest, schemaVersion: 2 },
      })
    ).toBe(false);
  });
  it('orders distinct Unicode keys without locale equivalence', () => {
    const a = { ...left, features: { 'e\u0301': 1, é: 2 } },
      b = { ...left, features: { é: 2, 'e\u0301': 1 } };
    expect(service.configurationMatchesSeed(a, b)).toBe(true);
  });
  it('does not weaken recorded owner/profile equality', () => {
    expect(
      service.configurationMatchesSeed(left, {
        ...left,
        ownerUserId: 'account-b',
      })
    ).toBe(false);
    expect(
      service.configurationMatchesSeed(left, {
        ...left,
        ownerProfileId: 'profile-b',
      })
    ).toBe(false);
  });
});
