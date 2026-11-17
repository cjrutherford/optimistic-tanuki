import {
  scanSourceCommunities,
  repairSourceCommunityRegister,
} from './community-directory-census';
import { requireCaptureIncarnation } from './community-directory-register-read';
import { lockCommunityDirectoryWrite } from './community-directory-outbox';

jest.mock('./community-directory-register-read', () => ({
  requireCaptureIncarnation: jest.fn(),
}));
jest.mock('./community-directory-outbox', () => ({
  lockCommunityDirectoryWrite: jest.fn(),
}));
const id = '00000000-0000-0000-0000-000000000001';
const token = '00000000-0000-0000-0000-000000000002';
const identity = {
  sourceEpoch: id,
  activationId: token,
  socialGeneration: '1',
};

describe('source census and register repair', () => {
  beforeEach(() => jest.clearAllMocks());
  it('scans community independently with bounded keyset', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ id }]) } as any;
    await expect(
      scanSourceCommunities(manager, identity, null, 2)
    ).resolves.toEqual([id]);
    expect(manager.query.mock.calls[0][0]).toContain('FROM community WHERE');
    await expect(
      scanSourceCommunities(manager, identity, null, 201)
    ).rejects.toThrow('limit');
  });
  it('preserves correct tokens and obtains writer authority before incarnation validation', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValue([
          {
            exists: true,
            communityId: id,
            operation: 'changed',
            dirty: true,
            changeToken: token,
          },
        ]),
    } as any;
    await expect(
      repairSourceCommunityRegister(manager, identity, id)
    ).resolves.toEqual({ status: 'unchanged' });
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(
      (lockCommunityDirectoryWrite as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
      (requireCaptureIncarnation as jest.Mock).mock.invocationCallOrder[0]
    );
  });
  it.each([
    { exists: true, communityId: null },
    {
      exists: true,
      communityId: id,
      operation: 'deleted',
      dirty: true,
      changeToken: token,
    },
    {
      exists: false,
      communityId: id,
      operation: 'changed',
      dirty: true,
      changeToken: token,
    },
    { exists: false, communityId: null },
  ])('repairs missing or contradictory state %#', async (row) => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([]),
    } as any;
    await expect(
      repairSourceCommunityRegister(manager, identity, id)
    ).resolves.toEqual({ status: 'repaired' });
    expect(manager.query.mock.calls[1][1][2]).toBe(
      row.exists ? 'changed' : 'deleted'
    );
  });
  it('does not mutate when source authority fails', async () => {
    (requireCaptureIncarnation as jest.Mock).mockRejectedValueOnce(
      new Error('authority')
    );
    const manager = { query: jest.fn() } as any;
    await expect(
      repairSourceCommunityRegister(manager, identity, id)
    ).rejects.toThrow('authority');
    expect(manager.query).not.toHaveBeenCalled();
  });
});
