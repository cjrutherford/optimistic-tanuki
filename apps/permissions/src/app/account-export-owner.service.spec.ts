import { of } from 'rxjs';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

import {
  PermissionsAccountExportOwnerService,
  PermissionsAccountExportOwnerError,
} from './account-export-owner.service';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondProfile = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const min = '00000000-0000-0000-0000-000000000000';
const roleId = '11111111-1111-4111-8111-111111111111';
const permissionId = '22222222-2222-4222-8222-222222222222';
const assignmentScopeId = '33333333-3333-4333-8333-333333333333';
const roleScopeId = '44444444-4444-4444-8444-444444444444';
const grant: any = {
  accountId: account,
  appId: 'permissions',
  token: 'private-token',
  jobId: '55555555-5555-4555-8555-555555555555',
  attempt: 1,
  leaseOwner: '66666666-6666-4666-8666-666666666666',
};
const descriptor: any = {
  participantId: 'profile',
  accountId: account,
  captureId: '77777777-7777-4777-8777-777777777777',
  handleId: '88888888-8888-4888-8888-888888888888',
  snapshotAt: '2026-10-20T12:00:00Z',
  expiresAt: '2026-10-20T12:05:00Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  identityCount: 2,
  sources: [],
  sourceRowCounts: {},
  sourceDispositions: {},
};

describe('PermissionsAccountExportOwnerService', () => {
  function setup(
    options: {
      assignment?: Record<string, unknown> | null;
      relationship?: Record<string, unknown> | null;
      failDrop?: boolean;
      lease?: unknown;
    } = {}
  ) {
    const events: string[] = [];
    let assignmentRead = false;
    let relationshipRead = false;
    const runner: any = {
      connect: jest.fn(async () => events.push('connect')),
      startTransaction: jest.fn(async () => events.push('begin')),
      commitTransaction: jest.fn(async () => events.push('commit')),
      rollbackTransaction: jest.fn(async () => events.push('rollback')),
      release: jest.fn(async () => events.push('release')),
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('CREATE TEMP')) {
          events.push('create-temp');
          return [];
        }
        if (sql.startsWith('DROP TABLE')) {
          events.push('drop');
          if (options.failDrop) throw new Error('raw database error');
          return [];
        }
        if (sql.includes('transaction_timestamp'))
          return [{ snapshotAt: '2026-10-20 12:00:00' }];
        if (sql.startsWith('INSERT INTO')) {
          events.push('identity-page');
          return [];
        }
        if (sql.includes('FROM "role_permissions" rp')) {
          if (relationshipRead || options.relationship === null) return [];
          relationshipRead = true;
          return [options.relationship ?? relationshipRow()];
        }
        if (sql.includes('FROM "role_assignment" a')) {
          if (assignmentRead || options.assignment === null) return [];
          assignmentRead = true;
          return [options.assignment ?? assignmentRow()];
        }
        return [];
      }),
      releasePostgresConnection: jest.fn(async () => events.push('evict')),
    };
    const identities: any = {
      readIdentities: jest.fn(
        async (
          _g: unknown,
          _d: unknown,
          page: (ids: readonly string[]) => Promise<void>
        ) => {
          await page([profile]);
          await page([secondProfile]);
        }
      ),
    };
    const auth: any = {
      send: jest.fn(() => of(options.lease ?? { valid: true })),
    };
    const svc = new PermissionsAccountExportOwnerService(
      { createQueryRunner: () => runner } as any,
      identities,
      auth
    );
    return { svc, runner, identities, auth, events };
  }

  function assignmentRow(): Record<string, unknown> {
    return {
      id: min,
      profileId: profile,
      profileIdLength: 36,
      targetId: 'deleted-resource-ref',
      targetIdLength: 20,
      roleId,
      appScopeId: assignmentScopeId,
      createdAt: '2026-10-20 12:00:00',
      roleContextId: roleId,
      roleName: 'owned role',
      roleNameLength: 10,
      roleDescription: 'role detail',
      roleDescriptionLength: 11,
      roleAppScopeId: roleScopeId,
      roleCreatedAt: '2026-10-20 11:00:00',
      assignmentScopeContextId: assignmentScopeId,
      assignmentScopeName: 'assignment scope',
      assignmentScopeNameLength: 16,
      assignmentScopeDescription: 'scope description',
      assignmentScopeDescriptionLength: 17,
      assignmentScopeActive: true,
      assignmentScopeCreatedAt: '2026-10-19 12:00:00',
      assignmentScopeUpdatedAt: null,
      roleScopeContextId: roleScopeId,
      roleScopeName: 'role scope',
      roleScopeNameLength: 10,
      roleScopeDescription: 'other scope detail',
      roleScopeDescriptionLength: 18,
      roleScopeActive: true,
      roleScopeCreatedAt: '2026-10-18 12:00:00',
      roleScopeUpdatedAt: null,
    };
  }

  function relationshipRow(): Record<string, unknown> {
    return {
      roleId,
      permissionId,
      roleContextId: roleId,
      roleName: 'owned role',
      roleNameLength: 10,
      roleDescription: 'role detail',
      roleDescriptionLength: 11,
      roleAppScopeId: roleScopeId,
      roleCreatedAt: '2026-10-20 11:00:00',
      roleScopeContextId: roleScopeId,
      roleScopeName: 'role scope',
      roleScopeNameLength: 10,
      roleScopeDescription: 'other scope detail',
      roleScopeDescriptionLength: 18,
      roleScopeActive: true,
      roleScopeCreatedAt: '2026-10-18 12:00:00',
      roleScopeUpdatedAt: null,
      permissionContextId: permissionId,
      permissionName: 'read-owned',
      permissionNameLength: 10,
      permissionDescription: 'permission text',
      permissionDescriptionLength: 15,
      permissionResource: 'video',
      permissionResourceLength: 5,
      permissionAction: 'read',
      permissionActionLength: 4,
      permissionTargetId: null,
      permissionTargetIdLength: null,
      permissionAppScopeId: null,
      permissionCreatedAt: '2026-10-17 12:00:00',
      permissionScopeContextId: null,
      permissionScopeName: null,
      permissionScopeNameLength: null,
      permissionScopeDescription: null,
      permissionScopeDescriptionLength: null,
      permissionScopeActive: null,
      permissionScopeCreatedAt: null,
      permissionScopeUpdatedAt: null,
    };
  }

  it('emits complete assignments and reachable cross-scope permission context, then releases before terminal proof', async () => {
    const x = setup();
    const chunks: any[] = [];
    const result = await x.svc.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        if (chunk.source === 'end') x.events.push('terminal');
      },
    });
    const assignment = chunks.find((chunk) => chunk.source === 'roleAssignment')
      .records[0].data;
    const link = chunks.find((chunk) => chunk.source === 'rolePermission')
      .records[0].data;
    expect(assignment).toMatchObject({
      id: min,
      profileId: profile,
      targetId: 'deleted-resource-ref',
      appScopeId: assignmentScopeId,
    });
    expect(assignment.role.appScopeId).toBe(roleScopeId);
    expect(link).toMatchObject({
      id: `${roleId}:${permissionId}`,
      permission: { appScopeId: null },
    });
    expect(x.identities.readIdentities).toHaveBeenCalledTimes(1);
    expect(
      x.runner.query.mock.calls.some(([sql]: [string]) =>
        sql.includes('owned."id"::text=lower(a."profileId")')
      )
    ).toBe(true);
    expect(x.events.filter((event) => event === 'identity-page')).toHaveLength(
      2
    );
    expect(x.events.indexOf('release')).toBeLessThan(
      x.events.indexOf('terminal')
    );
    expect(result.complete).toBe(true);
  });

  it('accepts a zero-permission role and validates non-BMP text by code point', async () => {
    const row = assignmentRow();
    row.roleDescription = '😀'.repeat(65_536);
    row.roleDescriptionLength = 65_536;
    const x = setup({ assignment: row, relationship: null });
    const chunks: any[] = [];
    await x.svc.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
      },
    });
    const assignment = chunks.find((chunk) => chunk.source === 'roleAssignment')
      .records[0].data;
    expect(Array.from(assignment.role.description)).toHaveLength(65_536);
    expect(
      chunks.find((chunk) => chunk.source === 'rolePermission').records
    ).toEqual([]);
  });

  it('fails closed on a missing required role or oversized description', async () => {
    const missingRole = assignmentRow();
    missingRole.roleContextId = null;
    await expect(
      setup({ assignment: missingRole }).svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
    const oversized = assignmentRow();
    oversized.roleDescriptionLength = 65_537;
    await expect(
      setup({ assignment: oversized }).svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
    const missingScope = assignmentRow();
    missingScope.roleScopeContextId = null;
    await expect(
      setup({ assignment: missingScope }).svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
    const missingPermission = relationshipRow();
    missingPermission.permissionContextId = null;
    await expect(
      setup({ relationship: missingPermission }).svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
  });

  it('rejects a non-exact lease response before connecting to PostgreSQL', async () => {
    const x = setup({ lease: { valid: true, debug: 'must not leak' } });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(x.runner.connect).not.toHaveBeenCalled();
  });

  it('sanitizes cleanup errors and quarantines a dirty runner', async () => {
    const x = setup({ failDrop: true });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    expect(x.runner.releasePostgresConnection).toHaveBeenCalled();
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
  });

  it('cancels delivery and rolls back before releasing the query runner', async () => {
    const x = setup();
    const controller = new AbortController();
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        signal: controller.signal,
        onChunk: async () => controller.abort(),
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_ABORTED' });
    expect(x.events).toContain('rollback');
    expect(x.events.indexOf('rollback')).toBeLessThan(
      x.events.indexOf('release')
    );
  });
});
