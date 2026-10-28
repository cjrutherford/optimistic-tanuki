import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';
import { AccountExportArtifactRetentionService } from '../account-export-jobs/account-export-artifact-retention.service';

const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const OP = '11111111-1111-4111-8111-111111111111';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const grant = (
  action: AccountDeletionGrant['action'],
  owner = 'authentication'
) =>
  ({
    contractVersion: '1',
    operationId: OP,
    accountId: ACCOUNT,
    appId: 'client-interface',
    owner,
    action,
    attempt: 1,
    leaseOwner: '44444444-4444-4444-8444-444444444444',
    expiresAt: '2099-01-01T00:00:00.000Z',
    signature: 'a'.repeat(64),
  } as unknown as AccountDeletionGrant);

function fixture() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const state = {
    tokens: [
      { userId: ACCOUNT, profileId: null as string | null, revoked: false },
      { userId: null as string | null, profileId: PROFILE, revoked: false },
      {
        userId: '88888888-8888-4888-8888-888888888888' as string | null,
        profileId: PROFILE,
        revoked: false,
      },
      {
        userId: null as string | null,
        profileId: '55555555-5555-4555-8555-555555555555',
        revoked: false,
      },
    ],
    guardianPermissions: [
      {
        userId: ACCOUNT,
        applicantEmail: 'private@example.test',
        dateOfBirth: '2000-01-01',
        guardianUserId: '66666666-6666-4666-8666-666666666666',
        guardianEmail: 'guardian@example.test',
        guardianTokenHash: 'g',
        resumeTokenHash: 'r',
        withdrawalTokenHash: 'w',
        attestationText: 'text',
        attestationVersion: 'v1',
        attestedAt: new Date(),
        resumeExpiresAt: new Date(),
        status: 'approved',
      },
      {
        userId: '77777777-7777-4777-8777-777777777777',
        applicantEmail: 'applicant@example.test',
        dateOfBirth: '2010-02-02',
        guardianUserId: ACCOUNT,
        guardianEmail: 'private@example.test',
        guardianTokenHash: 'g2',
        resumeTokenHash: 'r2',
        withdrawalTokenHash: 'w2',
        attestationText: 'text2',
        attestationVersion: 'v2',
        attestedAt: new Date(),
        resumeExpiresAt: new Date(),
        status: 'approved',
      },
    ],
    exportJobs: [{ accountId: ACCOUNT, coverageSummary: {} }],
  };
  const manager = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT "email" FROM "user_entity"'))
        return [{ email: 'private@example.test' }];
      if (sql.includes('COUNT(*)')) return [{ count: 0 }];
      if (
        sql.includes('SELECT "operationId" FROM account_deletion_write_fence')
      )
        return [{ operationId: OP }];
      if (sql.includes('SELECT "coverageSummary" FROM "account_export_jobs"'))
        return state.exportJobs.map(({ coverageSummary }) => ({
          coverageSummary,
        }));
      if (sql.includes('UPDATE "token"') && sql.includes('"userId"=$1'))
        state.tokens
          .filter((token) => token.userId === params[0])
          .forEach((token) => (token.revoked = true));
      if (sql.includes('UPDATE "token"') && sql.includes('"profileId" = ANY'))
        state.tokens
          .filter(
            (token) =>
              token.userId === null &&
              (params[0] as string[]).includes(token.profileId ?? '')
          )
          .forEach((token) => (token.revoked = true));
      if (sql.includes('UPDATE "guardian_permission"')) {
        const account = String(params[0]);
        for (const row of state.guardianPermissions) {
          const applicant = row.userId === account;
          const guardian = row.guardianUserId === account;
          if (!applicant && !guardian) continue;
          if (applicant) {
            row.applicantEmail = String(params[1]);
            row.dateOfBirth = null;
            row.userId = null;
          }
          if (guardian) {
            row.guardianUserId = null;
            row.guardianEmail = null;
          }
          row.guardianTokenHash = null;
          row.resumeTokenHash = null;
          row.withdrawalTokenHash = null;
          row.attestationText = null;
          row.attestationVersion = null;
          row.attestedAt = null;
          row.resumeExpiresAt = null;
          row.status = 'revoked';
        }
      }
      if (sql.includes('DELETE FROM "account_export_jobs"'))
        state.exportJobs = [];
      return [];
    }),
  };
  const authority = {
    validateGrant: jest.fn(async () => ({
      valid: true as const,
      accountId: ACCOUNT,
      scope: { currentProfileIds: [PROFILE], legacyProfileIds: [] },
    })),
  };
  const retention = {
    purgeAccount: jest.fn().mockResolvedValue({ removed: 0, failed: 0 }),
  };
  const database = {
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
      fn(manager)
    ),
    query: manager.query,
  };
  const service = new AccountDeletionOwnerService(
    authority as unknown as AccountDeletionAuthorityService,
    database as never,
    retention as unknown as AccountExportArtifactRetentionService
  );
  return { service, authority, retention, database, manager, queries, state };
}

describe('AccountDeletionOwnerService', () => {
  it('validates the authoritative grant before any write', async () => {
    const f = fixture();
    f.authority.validateGrant.mockRejectedValueOnce(new Error('bad signature'));
    await expect(f.service.fence(grant('fence'))).rejects.toThrow(
      'bad signature'
    );
    expect(f.queries).toHaveLength(0);
    expect(f.retention.purgeAccount).not.toHaveBeenCalled();
  });

  it('rejects wrong owner and action without writes', async () => {
    const f = fixture();
    await expect(f.service.fence(grant('fence', 'profile'))).rejects.toThrow(
      'GRANT_OWNER_OR_ACTION_INVALID'
    );
    await expect(f.service.erase(grant('fence'))).rejects.toThrow(
      'GRANT_OWNER_OR_ACTION_INVALID'
    );
    await expect(f.service.readback(grant('erase'))).rejects.toThrow(
      'GRANT_OWNER_OR_ACTION_INVALID'
    );
    expect(f.queries).toHaveLength(0);
    expect(f.retention.purgeAccount).not.toHaveBeenCalled();
  });

  it('retains export jobs for retry when artifact purge fails', async () => {
    const f = fixture();
    f.retention.purgeAccount.mockResolvedValueOnce({ removed: 0, failed: 1 });
    await expect(f.service.fence(grant('fence'))).rejects.toThrow(
      'ACCOUNT_DELETION_ARTIFACT_PURGE_FAILED'
    );
    expect(f.retention.purgeAccount).toHaveBeenCalledWith(ACCOUNT, OP);
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "account_export_jobs"')
      )
    ).toBe(false);
    expect(f.state.exportJobs).toHaveLength(1);
    await expect(f.service.fence(grant('fence'))).resolves.toEqual({
      fenced: true,
    });
    expect(f.retention.purgeAccount).toHaveBeenCalledTimes(2);
  });

  it('revokes account and captured profile tokens and removes authentication credentials', async () => {
    const f = fixture();
    await f.service.fence(grant('fence'));
    expect(
      f.queries.some(
        ({ sql, params }) =>
          sql.includes('"userId"=$1') &&
          sql.includes('revoked') &&
          params[0] === ACCOUNT
      )
    ).toBe(true);
    const profileRevocation = f.queries.find(({ sql }) =>
      sql.includes('"profileId" = ANY')
    );
    expect(profileRevocation?.params[0]).toEqual([PROFILE]);
    expect(f.state.tokens.map(({ revoked }) => revoked)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "oauth_provider" WHERE "userId"=$1')
      )
    ).toBe(true);
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "auth_action_token" WHERE "userId"=$1')
      )
    ).toBe(true);
  });

  it('clears only the matching guardian side and retains account roots', async () => {
    const f = fixture();
    await f.service.erase(grant('erase'));
    const update =
      f.queries.find(({ sql }) => sql.includes('UPDATE "guardian_permission"'))
        ?.sql ?? '';
    expect(update).toContain('"userId"=$1 OR "guardianUserId"=$1');
    expect(update).toContain('CASE WHEN "userId"=$1 THEN $2');
    expect(update).toContain('CASE WHEN "guardianUserId"=$1 THEN NULL');
    expect(f.state.guardianPermissions).toEqual([
      expect.objectContaining({
        userId: null,
        applicantEmail: '[deleted-account]',
        dateOfBirth: null,
        guardianUserId: '66666666-6666-4666-8666-666666666666',
        guardianEmail: 'guardian@example.test',
        status: 'revoked',
        guardianTokenHash: null,
        attestationText: null,
      }),
      expect.objectContaining({
        userId: '77777777-7777-4777-8777-777777777777',
        applicantEmail: 'applicant@example.test',
        dateOfBirth: '2010-02-02',
        guardianUserId: null,
        guardianEmail: null,
        status: 'revoked',
        resumeTokenHash: null,
      }),
    ]);
    expect(
      f.queries.some(({ sql }) =>
        /DELETE FROM "(?:user|key_datum|account_deletion_operations)"/.test(sql)
      )
    ).toBe(false);
    expect(
      f.queries.some(({ sql }) =>
        sql.includes(
          'DELETE FROM "guardian_policy_notice" WHERE "guardianUserId"=$1'
        )
      )
    ).toBe(true);
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "account_export_jobs" WHERE "accountId"=$1')
      )
    ).toBe(true);
  });

  it('returns independent readback counts with unresolved attribution explicitly represented', async () => {
    const f = fixture();
    await expect(f.service.readback(grant('readback'))).resolves.toEqual({
      complete: true,
      counts: {
        token_account: 0,
        token_profile: 0,
        oauth_provider: 0,
        auth_action_token: 0,
        guardian_permission: 0,
        guardian_policy_notice: 0,
        account_export_jobs: 0,
      },
      unresolvedAttribution: [],
    });
    expect(
      f.queries.filter(({ sql }) => sql.includes('COUNT(*)'))
    ).toHaveLength(7);
  });

  it('does not delete or revoke a token bound to another account through a captured profile', async () => {
    const f = fixture();
    await f.service.fence(grant('fence'));
    await f.service.erase(grant('erase'));
    expect(f.state.tokens[2]).toEqual({
      userId: '88888888-8888-4888-8888-888888888888',
      profileId: PROFILE,
      revoked: false,
    });
    expect(
      f.queries.some(
        ({ sql }) =>
          sql.includes('DELETE FROM "token"') &&
          sql.includes('"profileId" = ANY') &&
          sql.includes('"userId" IS NULL')
      )
    ).toBe(true);
  });

  it('fails closed on malformed count readbacks', async () => {
    const f = fixture();
    f.database.query = jest.fn().mockResolvedValueOnce([]);
    await expect(f.service.readback(grant('readback'))).rejects.toThrow(
      'ACCOUNT_DELETION_READBACK_INVALID'
    );
  });

  it('keeps export job rows when artifact cleanup failed or private payload remains', async () => {
    const f = fixture();
    f.retention.purgeAccount.mockResolvedValueOnce({ removed: 0, failed: 1 });
    await expect(f.service.erase(grant('erase'))).rejects.toThrow(
      'ACCOUNT_DELETION_ARTIFACT_PURGE_FAILED'
    );
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "account_export_jobs"')
      )
    ).toBe(false);
    f.state.exportJobs[0].coverageSummary = {
      privateArtifact: { artifactId: 'artifact' },
    };
    await expect(f.service.erase(grant('erase'))).rejects.toThrow(
      'ACCOUNT_DELETION_ARTIFACT_CLEANUP_PENDING'
    );
    expect(
      f.queries.some(({ sql }) =>
        sql.includes('DELETE FROM "account_export_jobs"')
      )
    ).toBe(false);
  });

  it('reports that profile scope is required after scope-null authentication fencing', async () => {
    const f = fixture();
    f.authority.validateGrant.mockResolvedValue({
      valid: true,
      accountId: ACCOUNT,
      scope: null,
    });
    await expect(f.service.fence(grant('fence'))).resolves.toEqual({
      fenced: false,
      scopeRequired: true,
    });
  });
});
