import { of, throwError } from 'rxjs';
import { AccountExportService } from './account-export.service';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const OTHER_ACCOUNT_ID = 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d';
const TOKEN = 'session-token-secret';
const PROFILE_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_PROFILE_ID = '10000000-0000-4000-8000-000000000002';
const FOREIGN_PROFILE_ID = '10000000-0000-4000-8000-000000000003';

describe('Permissions AccountExportService', () => {
  const assignmentRepository = { find: jest.fn() };
  const authClient = { send: jest.fn() };
  const profileClient = { send: jest.fn() };
  let service: AccountExportService;

  const page = (
    ids: string[],
    hasMore = false,
    nextCursor: string | null = null
  ) => ({
    accountId: ACCOUNT_ID,
    profileIds: ids,
    hasMore,
    nextCursor,
    unfenced: true,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    assignmentRepository.find.mockResolvedValue([]);
    authClient.send.mockReturnValue(
      of({ isValid: true, data: { userId: ACCOUNT_ID } })
    );
    profileClient.send.mockReturnValue(of(page([PROFILE_ID])));
    service = new AccountExportService(
      assignmentRepository as never,
      authClient as never,
      profileClient as never
    );
  });

  it('exports allowlisted assignments for verified owned profiles and stays partial', async () => {
    assignmentRepository.find.mockResolvedValueOnce([
      {
        id: '20000000-0000-4000-8000-000000000001',
        profileId: PROFILE_ID,
        roleId: '30000000-0000-4000-8000-000000000001',
        appScopeId: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        targetId: OTHER_ACCOUNT_ID,
        role: { permissions: [{ name: 'secret-permission' }] },
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        profileId: FOREIGN_PROFILE_ID,
        roleId: '30000000-0000-4000-8000-000000000001',
        appScopeId: null,
        created_at: new Date('2026-01-02T00:00:00Z'),
      },
    ]);

    const result = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );

    expect(result.status).toBe('partial');
    expect(result.data.assignments).toEqual([
      expect.objectContaining({
        id: '20000000-0000-4000-8000-000000000001',
        profileId: PROFILE_ID,
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      new RegExp(`${OTHER_ACCOUNT_ID}|secret-permission|session-token-secret`)
    );
    expect(result.uncovered).toContain(
      'profile-or-assignment-row-malformed-or-foreign'
    );
    expect(assignmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: expect.anything() },
        select: ['id', 'profileId', 'roleId', 'appScopeId', 'created_at'],
        loadEagerRelations: false,
      })
    );
  });

  it('rejects invalid sessions before querying the resolver or assignment repository', async () => {
    authClient.send.mockReturnValueOnce(
      of({ isValid: false, data: { userId: OTHER_ACCOUNT_ID } })
    );
    await expect(
      service.getAccountExportSnapshot(ACCOUNT_ID, TOKEN, 'client-interface')
    ).rejects.toBeDefined();
    expect(profileClient.send).not.toHaveBeenCalled();
    expect(assignmentRepository.find).not.toHaveBeenCalled();
    expect(authClient.send.mock.calls[0][0]).toEqual({
      cmd: AuthCommands.Validate,
    });
  });

  it('marks malformed or foreign resolver pages partial without querying assignments', async () => {
    profileClient.send.mockReturnValueOnce(
      of({ ...page([PROFILE_ID]), accountId: OTHER_ACCOUNT_ID })
    );
    const result = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(result.status).toBe('partial');
    expect(result.uncovered).toContain('profile-id-page-invalid');
    expect(assignmentRepository.find).not.toHaveBeenCalled();
    expect(profileClient.send.mock.calls[0][0]).toEqual({
      cmd: ProfileCommands.GetOwnedAccountProfileIdPage,
    });
  });

  it('consumes verified multiple pages and rejects repeated or non-progressing cursors', async () => {
    const pageTwo = '10000000-0000-4000-8000-000000000002';
    profileClient.send
      .mockReturnValueOnce(of(page([PROFILE_ID], true, PROFILE_ID)))
      .mockReturnValueOnce(of(page([pageTwo])));
    assignmentRepository.find
      .mockResolvedValueOnce([
        {
          id: '20000000-0000-4000-8000-000000000001',
          profileId: PROFILE_ID,
          roleId: '30000000-0000-4000-8000-000000000001',
          appScopeId: null,
          created_at: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '20000000-0000-4000-8000-000000000002',
          profileId: pageTwo,
          roleId: '30000000-0000-4000-8000-000000000001',
          appScopeId: null,
          created_at: new Date(),
        },
      ]);
    const result = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(result.data.assignments).toHaveLength(2);
    expect(profileClient.send).toHaveBeenCalledTimes(2);
    expect(profileClient.send.mock.calls[1][1]).toMatchObject({
      afterId: PROFILE_ID,
      limit: 100,
    });

    jest.clearAllMocks();
    authClient.send.mockReturnValue(
      of({ isValid: true, data: { userId: ACCOUNT_ID } })
    );
    profileClient.send
      .mockReturnValueOnce(of(page([PROFILE_ID], true, PROFILE_ID)))
      .mockReturnValueOnce(of(page([PROFILE_ID], true, PROFILE_ID)));
    assignmentRepository.find.mockResolvedValue([]);
    const repeated = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(repeated.uncovered).toContain('profile-id-page-invalid');
    expect(repeated.data.assignments).toEqual([]);
  });

  it('does not turn resolver read failures into an empty successful acknowledgement', async () => {
    profileClient.send.mockReturnValueOnce(
      of({ error: 'internal SQL details' })
    );
    const result = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(result.status).toBe('partial');
    expect(result.uncovered).toContain('profile-id-page-invalid');
    expect(result.data.assignments).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('internal SQL details');
    expect(assignmentRepository.find).not.toHaveBeenCalled();

    profileClient.send.mockReturnValueOnce(
      throwError(() => new Error('internal resolver details'))
    );
    const failedRead = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(failedRead.uncovered).toContain('profile-id-page-invalid');
    expect(failedRead.status).toBe('partial');
    expect(assignmentRepository.find).not.toHaveBeenCalled();
  });

  it('marks repository errors and assignment truncation explicitly', async () => {
    assignmentRepository.find.mockRejectedValueOnce(
      new Error('database error')
    );
    const failed = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(failed.uncovered).toContain('role-assignment-read-failed');

    assignmentRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        profileId: PROFILE_ID,
        roleId: '30000000-0000-4000-8000-000000000001',
        appScopeId: null,
        created_at: new Date(),
      }))
    );
    const truncated = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(truncated.uncovered).toContain(
      'role-assignment-preview-limit-exceeded'
    );
  });

  it('omits the participant payload when an added string exceeds the field budget', async () => {
    const ids = Array.from({ length: 1 }, () => PROFILE_ID);
    profileClient.send.mockReturnValueOnce(
      of({ ...page(ids), unfenced: true })
    );
    assignmentRepository.find.mockResolvedValueOnce([
      {
        id: '20000000-0000-4000-8000-000000000001',
        profileId: PROFILE_ID,
        roleId: 'x'.repeat(5000),
        appScopeId: null,
        created_at: new Date(),
      },
    ]);
    const result = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      TOKEN,
      'client-interface'
    );
    expect(JSON.stringify(result)).not.toContain('x'.repeat(100));
    expect(result.uncovered).toContain(
      'permission-preview-string-limit-exceeded'
    );
  });
});
