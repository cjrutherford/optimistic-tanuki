import * as authority from './social-authority';
import { recordCommunityChange } from './community-directory-outbox';
import { CommunityService } from './community.service';
import { CommunityDirectoryChange } from '../../entities/community-directory-change.entity';

const epoch = 'e1d4408a-8c90-41c9-9b14-45d708f9101d';
const active = {
  sourceEpoch: epoch,
  directoryRecoveryEpoch: epoch,
  fenced: false,
  phase: 'active',
  activationId: epoch,
  owner: epoch,
  socialGeneration: '1',
  directoryGeneration: '1',
  preparedPayload: {
    accepted: { version: 'directory-enabled-v1', digest: 'a'.repeat(64) },
  },
};
describe('recordCommunityChange', () => {
  const previous = process.env.SOCIAL_DIRECTORY_MODE;
  const previousCap = process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
  beforeEach(() => {
    jest
      .spyOn(authority, 'trustedDirectoryRuntimeEpochs')
      .mockReturnValue({ sourceEpoch: epoch, recoveryEpoch: epoch });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previous === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
    else process.env.SOCIAL_DIRECTORY_MODE = previous;
    if (previousCap === undefined)
      delete process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
    else process.env.DIRECTORY_OUTBOX_MAX_EVENTS = previousCap;
  });
  const manager = (authority: unknown[] = [], legacy: unknown[] = []) => ({
    queryRunner: { isTransactionActive: true },
    query: jest.fn(async (sql: string) =>
      sql.includes('SELECT "sourceEpoch", "directoryRecoveryEpoch", fenced')
        ? authority
        : sql.includes('WHERE "sourceEpoch" IS NULL')
        ? legacy
        : []
    ),
    insert: jest.fn(),
  });
  it('does not enqueue inactive changes even beyond the configured cap', async () => {
    delete process.env.SOCIAL_DIRECTORY_MODE;
    process.env.DIRECTORY_OUTBOX_MAX_EVENTS = '1';
    const m = manager();
    for (let i = 0; i < 5; i++)
      await recordCommunityChange(
        m as any,
        epoch,
        i === 4 ? 'deleted' : 'changed'
      );
    expect(m.query).toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });
  it('rejects inactive mutations when authority exists', async () => {
    delete process.env.SOCIAL_DIRECTORY_MODE;
    const m = manager([{ sourceEpoch: epoch, fenced: true }]);
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('inactive');
  });
  it('rejects unbound active authority', async () => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    const m = manager([
      { sourceEpoch: epoch, directoryRecoveryEpoch: null, fenced: false },
    ]);
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('authority unavailable');
  });
  it('binds active events to the locked epoch', async () => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    const m = manager([active]);
    await recordCommunityChange(m as any, epoch, 'deleted');
    expect(m.insert).toHaveBeenCalledWith(
      CommunityDirectoryChange,
      expect.objectContaining({
        communityId: epoch,
        operation: 'deleted',
        sourceEpoch: epoch,
        eventNonce: expect.any(String),
      })
    );
  });
  it.each([
    [[]],
    [[{ sourceEpoch: epoch, fenced: true }]],
    [[{ sourceEpoch: null, fenced: false }]],
  ])('refuses absent or fenced authority', async (rows) => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    const m = manager(rows);
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('authority unavailable');
    expect(m.insert).not.toHaveBeenCalled();
  });
  it('rejects active changes when the bounded outbox is full', async () => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    const m = manager([active]);
    m.query.mockImplementation(async (sql: string) =>
      sql.includes('SELECT "sourceEpoch", "directoryRecoveryEpoch", fenced')
        ? [active]
        : sql.includes('ORDER BY revision OFFSET')
        ? [{ revision: '1' }]
        : []
    );
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('outbox is full');
    expect(m.insert).not.toHaveBeenCalled();
  });
  it('rejects unresolved legacy events and invalid mode', async () => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    const m = manager([active], [{}]);
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('Legacy');
    process.env.SOCIAL_DIRECTORY_MODE = 'invalid';
    await expect(
      recordCommunityChange(m as any, epoch, 'changed')
    ).rejects.toThrow('SOCIAL_DIRECTORY_MODE');
    expect(m.insert).not.toHaveBeenCalled();
  });
});

describe('Directory recovery gate', () => {
  it('refuses readiness even with active mode and an apparently valid epoch', async () => {
    const prior = process.env.SOCIAL_DIRECTORY_MODE;
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    try {
      const repo = {
        manager: { query: jest.fn().mockResolvedValue([active]) },
      };
      const service = new CommunityService(
        repo as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      await expect(service.assertDirectoryReady()).rejects.toThrow(
        'reconciliation'
      );
      expect(repo.manager.query).not.toHaveBeenCalled();
    } finally {
      if (prior === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = prior;
    }
  });
});
