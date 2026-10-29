import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createWorkspaceAccountExportSources } from './account-export-sources';

const id = '123e4567-e89b-42d3-a456-426614174000';
const row = {
  id,
  kind: 'community',
  slug: 'hello',
  displayName: 'Hello',
  appScope: 'workspace',
  ownerUserId: id,
  ownerProfileId: id,
  status: 'active',
  sourceService: 'social',
  sourceId: id,
  createdAt: '2026-10-22 12:00:00',
  updatedAt: '2026-10-22 12:00:00',
};

describe('Workspace account export source', () => {
  it('uses the registered source and a bounded deterministic keyset query', () => {
    expect(WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES).toEqual(['Workspace']);
    const source = createWorkspaceAccountExportSources('profile')[0];
    expect(source.sql).toContain('lower(r."ownerUserId"::text)=$1');
    expect(source.sql).toContain('identities.id::text');
    expect(source.sql).toContain('COLLATE "C"');
    expect(source.sql).toContain('LIMIT $3');
    expect(source.sql).not.toMatch(/\bOFFSET\b/i);
    expect(source.sql).toContain('left(r."slug"::text,256)');
    expect(source.sql).toContain('left(r."appScope"::text,129)');
    expect(source.sql.match(/ AS "/g)).toHaveLength(12);
  });

  it('projects only allowlisted fields with explicit legacy attribution and consent', () => {
    const result = createWorkspaceAccountExportSources('profile')[0].project(
      { ...row, secret: 'omit' },
      id
    );
    expect(result).toEqual({
      id,
      kind: 'community',
      slug: 'hello',
      displayName: 'Hello',
      appScope: 'workspace',
      ownerUserId: id,
      ownerProfileId: id,
      status: 'active',
      sourceService: 'social',
      sourceId: id,
      createdAt: '2026-10-22T12:00:00.000Z',
      updatedAt: '2026-10-22T12:00:00.000Z',
      attribution: 'recorded-unverified',
      consent: 'not-inferred',
    });
    expect(result).not.toHaveProperty('secret');
  });

  it('rejects owner mismatch, noncanonical ids, unknown enums and overlong text', () => {
    const project = createWorkspaceAccountExportSources('profile')[0].project;
    expect(() =>
      project(
        { ...row, ownerUserId: '123e4567-e89b-42d3-a456-426614174001' },
        id
      )
    ).toThrow('WORKSPACE_EXPORT_IDENTITY_MISMATCH');
    expect(() => project({ ...row, sourceId: 'bad' }, id)).toThrow(
      'WORKSPACE_EXPORT_INVALID_ID'
    );
    expect(() => project({ ...row, status: 'published' }, id)).toThrow(
      'WORKSPACE_EXPORT_UNKNOWN_ENUM'
    );
    expect(() => project({ ...row, kind: 'finance-tenant' }, id)).toThrow(
      'WORKSPACE_EXPORT_UNKNOWN_ENUM'
    );
    expect(() => project({ ...row, displayName: 'x'.repeat(256) }, id)).toThrow(
      'WORKSPACE_EXPORT_INVALID_TEXT'
    );
    expect(() => project({ ...row, appScope: '' }, id)).toThrow(
      'WORKSPACE_EXPORT_INVALID_TEXT'
    );
  });

  it('rejects unsafe profile table identifiers', () => {
    expect(() =>
      createWorkspaceAccountExportSources('profile";DROP TABLE workspaces')
    ).toThrow('WORKSPACE_EXPORT_INVALID_PROFILE_TABLE');
  });
  it('preserves PostgreSQL sub-millisecond timestamp precision', () => {
    const result = createWorkspaceAccountExportSources('profile')[0].project(
      {
        ...row,
        createdAt: '2026-10-23 01:02:03.123456',
        updatedAt: '2026-10-23 02:02:03.654321',
      },
      id
    );
    expect(result.createdAt).toBe('2026-10-23T01:02:03.123456Z');
    expect(result.updatedAt).toBe('2026-10-23T02:02:03.654321Z');
  });
});
