import { ACCOUNT_DELETION_OWNERS } from '@optimistic-tanuki/models';
import { randomUUID } from 'node:crypto';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';

const ACCOUNT = randomUUID();
const OP = randomUUID();
const OWNER = randomUUID();
const NOW = new Date(Date.now() + 60_000);

function harness() {
  const row: any = {
    id: OP,
    accountId: ACCOUNT,
    appId: 'client-interface',
    state: 'fencing',
    idempotencyKey: randomUUID(),
    attempt: 1,
    leaseOwner: OWNER,
    leaseExpiresAt: NOW,
    privateScope: null,
    ownerProgress: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const query = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(row),
  };
  const repository: any = {
    findOneBy: jest.fn().mockResolvedValue(row),
    findOne: jest.fn().mockResolvedValue(row),
    createQueryBuilder: jest.fn(() => query),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const manager: any = {
    query: jest.fn(),
    getRepository: jest.fn(() => repository),
  };
  const database: any = { transaction: jest.fn(async (work) => work(manager)) };
  return {
    row,
    query,
    repository,
    manager,
    database,
    service: new AccountDeletionAuthorityService(repository, database),
  };
}

describe('AccountDeletionAuthorityService', () => {
  const proofKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
  beforeEach(() => {
    process.env['ACCOUNT_DELETION_PROOF_KEY'] =
      'unit-test-signing-secret-that-is-long-enough';
  });
  afterAll(() => {
    if (proofKey === undefined)
      delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
    else process.env['ACCOUNT_DELETION_PROOF_KEY'] = proofKey;
  });

  it('serializes account acceptance and returns the existing active operation', async () => {
    const h = harness();
    const operation = await h.service.accept(
      ACCOUNT,
      'client-interface',
      randomUUID()
    );
    expect(operation).toBe(h.row);
    expect(h.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      [ACCOUNT]
    );
    expect(h.repository.create).not.toHaveBeenCalled();
  });

  it('cannot redirect a saved browser preparation to an existing different operation', async () => {
    const h = harness();
    await expect(
      h.service.accept(ACCOUNT, 'client-interface', randomUUID(), randomUUID())
    ).rejects.toThrow('ACCOUNT_DELETION_PREPARATION_CONFLICT');
    expect(h.repository.create).not.toHaveBeenCalled();
  });

  it('rejects malformed prepared operation IDs before mutation', async () => {
    const h = harness();
    await expect(
      h.service.accept(
        ACCOUNT,
        'client-interface',
        randomUUID(),
        'not-an-operation'
      )
    ).rejects.toThrow('ACCOUNT_DELETION_OPERATION_INVALID');
    expect(h.database.transaction).not.toHaveBeenCalled();
  });

  it('reuses the permanent account fence after completion and across apps', async () => {
    const h = harness();
    h.row.state = 'complete';
    h.row.appId = 'local-hub';
    const operation = await h.service.accept(
      ACCOUNT,
      'client-interface',
      randomUUID()
    );
    expect(operation).toBe(h.row);
    expect(h.repository.findOne).toHaveBeenCalledWith({
      where: { fenceKey: expect.any(String) },
    });
    expect(h.repository.create).not.toHaveBeenCalled();
  });

  it('signs grants, rejects tampering and returns only ledger scope', async () => {
    const h = harness();
    h.row.privateScope = {
      currentProfileIds: [randomUUID()],
      legacyProfileIds: ['old-key'],
    };
    h.row.ownerProgress = Object.fromEntries(
      ACCOUNT_DELETION_OWNERS.map((owner) => [owner, { fence: true }])
    );
    const grant = await h.service.issueGrant(OP, 'assets', 'erase');
    await expect(
      h.service.validateGrant({ ...grant, action: 'fence' })
    ).rejects.toThrow();
    await expect(h.service.validateGrant(grant)).resolves.toEqual({
      valid: true,
      accountId: ACCOUNT,
      scope: h.row.privateScope,
    });
  });

  it('rejects stale lease grants and does not sign without configured key', async () => {
    const h = harness();
    h.row.leaseExpiresAt = new Date(Date.now() - 1);
    await expect(h.service.issueGrant(OP, 'profile', 'fence')).rejects.toThrow(
      'ACCOUNT_DELETION_LEASE_STALE'
    );
    delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
    h.row.leaseExpiresAt = NOW;
    await expect(h.service.issueGrant(OP, 'profile', 'fence')).rejects.toThrow(
      'ACCOUNT_DELETION_PROOF_KEY_REQUIRED'
    );
  });

  it('rejects a proof key shorter than 32 UTF-8 bytes for signing and verification', async () => {
    const h = harness();
    process.env['ACCOUNT_DELETION_PROOF_KEY'] = 'short';
    await expect(h.service.issueGrant(OP, 'profile', 'fence')).rejects.toThrow(
      'ACCOUNT_DELETION_PROOF_KEY_REQUIRED'
    );
    const grant = {
      contractVersion: 1,
      operationId: OP,
      accountId: ACCOUNT,
      appId: 'client-interface',
      owner: 'profile',
      action: 'fence',
      attempt: 1,
      leaseOwner: OWNER,
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
      signature: '0'.repeat(64),
    };
    await expect(h.service.validateGrant(grant)).rejects.toThrow(
      'ACCOUNT_DELETION_PROOF_KEY_REQUIRED'
    );
  });

  it('records validated profile scope once and rejects conflicting scope', async () => {
    const h = harness();
    const grant = await h.service.issueGrant(OP, 'profile', 'fence');
    const scope = {
      currentProfileIds: [randomUUID()],
      legacyProfileIds: ['legacy-key'],
    };
    await h.service.recordProfileScope(grant, scope);
    expect(h.row.privateScope).toEqual(scope);
    await expect(
      h.service.recordProfileScope(grant, {
        currentProfileIds: [],
        legacyProfileIds: [],
      })
    ).rejects.toThrow('ACCOUNT_DELETION_SCOPE_CONFLICT');
  });

  it('accepts reordered scope as the same set and rejects stale replay after lease changes', async () => {
    const h = harness();
    const grant = await h.service.issueGrant(OP, 'profile', 'fence');
    const a = randomUUID();
    const b = randomUUID();
    await h.service.recordProfileScope(grant, {
      currentProfileIds: [a, b],
      legacyProfileIds: ['key-b', 'key-a'],
    });
    await h.service.recordProfileScope(grant, {
      currentProfileIds: [b, a],
      legacyProfileIds: ['key-a', 'key-b'],
    });
    h.row.appId = 'local-hub';
    await expect(
      h.service.recordProfileScope(grant, {
        currentProfileIds: [b, a],
        legacyProfileIds: ['key-a', 'key-b'],
      })
    ).rejects.toThrow('ACCOUNT_DELETION_GRANT_STALE');
  });

  it('blocks erasure before every required owner has acknowledged its fence', async () => {
    const h = harness();
    h.row.privateScope = { currentProfileIds: [], legacyProfileIds: [] };
    await expect(h.service.issueGrant(OP, 'assets', 'erase')).rejects.toThrow(
      'ACCOUNT_DELETION_FENCES_PENDING'
    );
    const grant = await h.service.issueGrant(OP, 'assets', 'fence');
    await h.service.acknowledge(grant);
    expect(h.row.ownerProgress.assets).toEqual({
      fence: true,
      erase: false,
      readback: false,
    });
    expect(h.row.state).toBe('fencing');
  });

  it('projects public status without account, scope, or lease fields', async () => {
    const h = harness();
    const status = await h.service.status(OP);
    expect(status).toMatchObject({
      operationId: OP,
      appId: 'client-interface',
      attempt: 1,
    });
    expect(status).not.toHaveProperty('accountId');
    expect(status).not.toHaveProperty('privateScope');
    expect(status).not.toHaveProperty('leaseOwner');
  });

  it('sanitizes corrupted owner progress and state before public projection', async () => {
    const h = harness();
    h.row.state = { secret: 'private-state' };
    h.row.ownerProgress = {
      assets: { status: 'complete', privateProfileId: ACCOUNT },
      profile: 'unknown-private-value',
    };
    const status = await h.service.status(OP);
    expect(status.state).toBe('blocked');
    expect(
      status.progress.find((item) => item.owner === 'assets')?.status
    ).toBe('pending');
    expect(JSON.stringify(status)).not.toContain(ACCOUNT);
    expect(JSON.stringify(status)).not.toContain('private-state');
  });
  it('projects persisted phase receipts accurately without exposing internal identity scope', async () => {
    const h = harness();
    h.row.ownerProgress = {
      profile: { fence: true, erase: true, readback: true },
      assets: { fence: true },
    };
    let status = await h.service.status(OP);
    expect(
      status.progress.find((item) => item.owner === 'profile')?.status
    ).toBe('complete');
    expect(
      status.progress.find((item) => item.owner === 'assets')?.status
    ).toBe('running');
    h.row.state = 'complete';
    status = await h.service.status(OP);
    expect(status.progress.every((item) => item.status === 'complete')).toBe(
      true
    );
    expect(JSON.stringify(status)).not.toContain(ACCOUNT);
  });
});
