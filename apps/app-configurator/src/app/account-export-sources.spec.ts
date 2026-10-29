import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createAppConfiguratorAccountExportSources } from './account-export-sources';

const account = '123e4567-e89b-42d3-a456-426614174000',
  profile = '123e4567-e89b-42d3-a456-426614174001',
  id = '123e4567-e89b-42d3-a456-426614174002';
const base = {
  id,
  workspaceId: id,
  appInstanceId: id,
  ownerUserId: account,
  ownerProfileId: profile,
  appScope: 'site',
  status: 'active',
  createdAt: '2025-01-01 01:02:03.123456',
  updatedAt: '2025-01-01 01:02:03.654321',
};
describe('App Configurator export sources', () => {
  it('keeps fixed source order and uses bounded safe keyset SQL', () => {
    const sources = createAppConfiguratorAccountExportSources('profiles');
    expect(sources.map((s) => s.source)).toEqual(
      APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    for (const s of sources) {
      expect(s.sql).toContain('LIMIT $3');
      expect(s.sql).toContain('COLLATE "C"');
      expect(s.sql).toContain('$1');
      expect(s.sql).toContain('$2');
      expect(s.sql).not.toMatch(
        /description|landingPage|routes|features|theme|manifest|release/
      );
    }
    expect(sources[0].sql).toContain('r."active"');
    expect(sources[0].sql).not.toContain('r."active"::text');
    expect(sources[0].sql).toContain(
      'lower(p."ownerUserId"::text)=lower(r."ownerUserId"::text)'
    );
    expect(sources[0].sql).toContain(
      'lower(p."ownerProfileId"::text)=lower(r."ownerProfileId"::text)'
    );
    expect(sources[2].sql).toContain('p."workspaceId"=r."workspaceId"');
    expect(sources[2].sql).toContain('p."appScope"=r."appScope"');
  });
  it('projects instance timestamps with microseconds and rejects malformed UUIDs', () => {
    const src = createAppConfiguratorAccountExportSources('profiles')[1];
    expect(src.project(base, account).createdAt).toBe(
      '2025-01-01T01:02:03.123456Z'
    );
    expect(() => src.project({ ...base, id: 'bad' }, account)).toThrow();
  });
  it('fails configuration parent mismatches, invalid domains, and invalid revision', () => {
    const src = createAppConfiguratorAccountExportSources('profiles')[0];
    const row = {
      ...base,
      name: 'Name',
      domain: 'https://user:secret@example.test',
      active: true,
      accessPolicy: 'public',
      revision: 1,
      parentValid: true,
    };
    expect(() => src.project(row, account)).toThrow(/DOMAIN/);
    expect(() =>
      src.project({ ...row, domain: null, parentValid: false }, account)
    ).toThrow(/PARENT/);
    expect(() =>
      src.project({ ...row, domain: null, revision: 0 }, account)
    ).toThrow(/REVISION/);
  });
  it('retains own historical membership without exposing parent owner fields', () => {
    const src = createAppConfiguratorAccountExportSources('profiles')[2];
    const result = src.project(
      {
        ...base,
        userId: account,
        profileId: profile,
        role: 'member',
        status: 'revoked',
        parentValid: true,
      },
      account
    );
    expect(result.status).toBe('revoked');
    expect(result).not.toHaveProperty('ownerUserId');
  });
  it('accepts the shared driver normalized temporary table name for a hyphenated participant', () => {
    const name = 'app_configurator_export_scope_' + 'a'.repeat(32);
    const sources = createAppConfiguratorAccountExportSources(name);
    expect(sources).toHaveLength(3);
    for (const source of sources)
      expect(source.sql).toContain('FROM "' + name + '" identities');
    expect(() =>
      createAppConfiguratorAccountExportSources(
        name + '"; DROP TABLE app_instances;--'
      )
    ).toThrow(/PROFILE_TABLE/);
  });
  it('rejects unsafe profile table identifiers', () =>
    expect(() =>
      createAppConfiguratorAccountExportSources('profiles;drop')
    ).toThrow());
});
