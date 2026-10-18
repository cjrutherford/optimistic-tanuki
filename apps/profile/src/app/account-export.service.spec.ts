import { ProfileAccountExportService } from './account-export.service';
import { of } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { ACCOUNT_EXPORT_PREVIEW_BUDGETS } from '@optimistic-tanuki/models';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const OTHER_ACCOUNT_ID = 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d';
const SESSION_TOKEN = 'session-bearer-secret';

describe('ProfileAccountExportService', () => {
  const profileRepository = { find: jest.fn() };
  const timelineRepository = { find: jest.fn() };
  const activityRepository = { find: jest.fn() };
  const authClient = { send: jest.fn() };
  let service: ProfileAccountExportService;

  beforeEach(() => {
    jest.resetAllMocks();
    profileRepository.find.mockResolvedValue([]);
    timelineRepository.find.mockResolvedValue([]);
    authClient.send.mockReturnValue(
      of({ isValid: true, data: { userId: ACCOUNT_ID } })
    );
    activityRepository.find.mockResolvedValue([]);
    service = new ProfileAccountExportService(
      profileRepository as never,
      timelineRepository as never,
      activityRepository as never,
      authClient as never
    );
  });

  it('projects own guardian activity only after verifying profile ownership', async () => {
    timelineRepository.find.mockResolvedValueOnce([]);
    profileRepository.find
      .mockResolvedValueOnce([{ id: 'owned-profile', userId: ACCOUNT_ID }])
      .mockResolvedValueOnce([
        { id: 'owned-profile', userId: ACCOUNT_ID },
        { id: 'foreign-profile', userId: OTHER_ACCOUNT_ID },
      ]);
    activityRepository.find.mockResolvedValue([
      {
        actorUserId: OTHER_ACCOUNT_ID,
        dependentUserId: ACCOUNT_ID,
        profileId: 'owned-profile',
        appId: 'client-interface',
        operation: 'profile.manage',
        changedFieldNames: ['bio'],
        createdAt: new Date('2025-01-01T00:00:00Z'),
      },
      {
        actorUserId: ACCOUNT_ID,
        dependentUserId: OTHER_ACCOUNT_ID,
        profileId: 'foreign-profile',
        appId: 'client-interface',
        operation: 'profile.view',
        changedFieldNames: ['email'],
        createdAt: new Date('2025-01-02T00:00:00Z'),
      },
      {
        actorUserId: ACCOUNT_ID,
        dependentUserId: ACCOUNT_ID,
        profileId: 'owned-profile',
        appId: 'client-interface',
        operation: 'profile.view',
        changedFieldNames: [],
        createdAt: new Date(),
      },
      {
        actorUserId: OTHER_ACCOUNT_ID,
        dependentUserId: ACCOUNT_ID,
        profileId: 'orphan-profile',
        appId: 'client-interface',
        operation: 'profile.view',
        changedFieldNames: [],
        createdAt: new Date(),
      },
    ]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    const data = snapshot.data as Record<string, any>;
    expect(data.guardianActivity).toEqual([
      expect.objectContaining({
        role: 'dependent',
        profileId: 'owned-profile',
        changedFieldNames: ['bio'],
      }),
      expect.objectContaining({ role: 'guardian' }),
    ]);
    expect(data.guardianActivity[1]).not.toHaveProperty('profileId');
    expect(data.guardianActivity[1]).not.toHaveProperty('changedFieldNames');
    expect(snapshot.uncovered).toContain(
      'guardian-profile-activity-owner-mismatch-or-orphan'
    );
    expect(snapshot.uncovered).toContain(
      'guardian-profile-activity-malformed-or-self-row'
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      new RegExp(`${OTHER_ACCOUNT_ID}|foreign-profile`)
    );
    expect(activityRepository.find.mock.calls[0][0].where).toEqual([
      { actorUserId: ACCOUNT_ID },
      { dependentUserId: ACCOUNT_ID },
    ]);
  });

  it('omits owner-matched activity rows with an unsupported operation', async () => {
    profileRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'owned-profile', userId: ACCOUNT_ID }]);
    activityRepository.find.mockResolvedValueOnce([
      {
        actorUserId: OTHER_ACCOUNT_ID,
        dependentUserId: ACCOUNT_ID,
        profileId: 'owned-profile',
        appId: 'client-interface',
        operation: 'profile.delete',
        changedFieldNames: [],
        createdAt: new Date('2025-01-01T00:00:00Z'),
      },
    ]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect((snapshot.data as Record<string, any>).guardianActivity).toEqual([]);
    expect(snapshot.uncovered).toContain(
      'guardian-profile-activity-malformed-or-self-row'
    );
    expect(snapshot.uncovered).not.toContain(
      'guardian-profile-activity-owner-mismatch-or-orphan'
    );
    expect(profileRepository.find.mock.calls[1][0]).toEqual({
      where: [{ id: 'owned-profile', userId: ACCOUNT_ID }],
      select: ['id', 'userId'],
    });
  });

  it('marks guardian-activity read failures and row truncation without claiming zero history', async () => {
    activityRepository.find.mockRejectedValueOnce(
      new Error('activity SQL secret')
    );
    const failed = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(failed.uncovered).toContain('guardian-profile-activity-read-failed');
    expect(JSON.stringify(failed)).not.toContain('activity SQL secret');

    profileRepository.find.mockResolvedValueOnce([]);
    activityRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, index) => ({
        actorUserId: ACCOUNT_ID,
        dependentUserId: OTHER_ACCOUNT_ID,
        profileId: 'foreign-profile',
        appId: 'client-interface',
        operation: 'profile.view',
        createdAt: new Date('2025-01-01T00:00:00Z'),
      }))
    );
    profileRepository.find.mockResolvedValueOnce([
      { id: 'foreign-profile', userId: OTHER_ACCOUNT_ID },
    ]);
    const truncated = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(truncated.uncovered).toContain(
      'guardian-profile-activity-preview-limit-exceeded'
    );
    expect(
      (truncated.data as Record<string, any>).guardianActivity
    ).toHaveLength(1000);
  });

  it('applies string and serialized participant budgets to changed-field metadata', async () => {
    profileRepository.find.mockResolvedValueOnce([]);
    activityRepository.find.mockResolvedValueOnce([
      {
        actorUserId: 'd8e3819c-cf3e-424a-a2a7-8aa412ff5db9',
        dependentUserId: ACCOUNT_ID,
        profileId: 'owned-profile',
        appId: 'client-interface',
        operation: 'profile.manage',
        changedFieldNames: [
          'x'.repeat(
            ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters + 1
          ),
        ],
        createdAt: new Date(),
      },
    ]);
    profileRepository.find.mockResolvedValueOnce([
      { id: 'owned-profile', userId: ACCOUNT_ID },
    ]);
    const overString = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect((overString.data as Record<string, any>).guardianActivity).toEqual(
      []
    );
    expect(overString.uncovered).toContain(
      'profile-preview-string-limit-exceeded'
    );
    expect(JSON.stringify(overString)).not.toContain('x'.repeat(100));

    profileRepository.find.mockResolvedValueOnce([]);
    activityRepository.find.mockResolvedValueOnce(
      Array.from({ length: 150 }, () => ({
        actorUserId: ACCOUNT_ID,
        dependentUserId: OTHER_ACCOUNT_ID,
        profileId: 'foreign-profile',
        appId: 'a'.repeat(4096),
        operation: 'profile.view',
        changedFieldNames: [],
        createdAt: new Date('2025-01-01T00:00:00Z'),
      }))
    );
    profileRepository.find.mockResolvedValueOnce([
      { id: 'foreign-profile', userId: OTHER_ACCOUNT_ID },
    ]);
    const overBytes = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    const limits = (overBytes.data as Record<string, any>).previewLimits;
    expect(limits.dataOmittedForBudget).toBe(true);
    expect(overBytes.uncovered).toContain(
      'profile-preview-response-budget-exceeded'
    );
    expect(
      Buffer.byteLength(JSON.stringify(overBytes), 'utf8')
    ).toBeLessThanOrEqual(limits.maxSerializedBytes);
  });

  it('returns all owned profiles and their owned timelines without serializing entity extensions', async () => {
    profileRepository.find.mockResolvedValue([
      {
        id: 'profile-global',
        userId: ACCOUNT_ID,
        appScope: 'global',
        profileName: 'Owner',
        blogRole: 'poster',
        profilePic: 'encrypted://avatar',
        coverPic: 'encrypted://cover',
        bio: 'Bio',
        location: 'Town',
        occupation: 'Builder',
        interests: 'Art',
        skills: 'Making',
        created_at: new Date('2025-01-01T00:00:00Z'),
        password: 'must-not-leak',
        totpSecret: 'must-not-leak',
      },
      {
        id: 'profile-client',
        userId: ACCOUNT_ID,
        appScope: 'client-interface',
        profileName: 'Owner OT',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date('2025-02-01T00:00:00Z'),
      },
      { id: 'foreign-profile', userId: OTHER_ACCOUNT_ID },
    ]);
    timelineRepository.find.mockResolvedValue([
      {
        id: 'owned-timeline',
        userId: ACCOUNT_ID,
        title: 'Owned',
        description: 'Owned event',
        timeStamp: new Date('2025-02-02T00:00:00Z'),
        eventType: 'Posted',
        related_profile: { id: 'profile-global', userId: ACCOUNT_ID },
        password: 'must-not-leak',
      },
      {
        id: 'foreign-owner-timeline',
        userId: OTHER_ACCOUNT_ID,
        title: 'Foreign',
        related_profile: { id: 'profile-global', userId: ACCOUNT_ID },
      },
      {
        id: 'foreign-profile-timeline',
        userId: ACCOUNT_ID,
        title: 'Foreign profile row',
        related_profile: { id: 'foreign-profile', userId: OTHER_ACCOUNT_ID },
      },
    ]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data.profiles.map(({ id }) => id)).toEqual([
      'profile-global',
      'profile-client',
    ]);
    expect(snapshot.data.timelines.map(({ id }) => id)).toEqual([
      'owned-timeline',
    ]);
    expect(snapshot.data.profiles[0].blogRole).toBe('poster');
    expect(profileRepository.find.mock.calls[0][0].select).toContain(
      'blogRole'
    );
    expect(JSON.stringify(snapshot)).not.toContain('must-not-leak');
    expect(snapshot.data.media).toEqual({
      referencesIncluded: false,
      inlineMediaExcluded: true,
      portableBytesIncluded: false,
    });
    expect(snapshot.uncovered).toEqual(
      expect.arrayContaining([
        'guardian-profile-activity',
        'profile-media-references',
        'profile-media-bytes',
        'profile-preview-read-memory-unbounded',
      ])
    );
    const selectedFields = profileRepository.find.mock.calls[0][0].select;
    expect(selectedFields).not.toContain('profilePic');
    expect(selectedFields).not.toContain('coverPic');
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      {
        token: SESSION_TOKEN,
        userId: ACCOUNT_ID,
        appId: 'client-interface',
      }
    );
  });

  it('rejects missing or invalid account IDs before querying either repository', async () => {
    await expect(
      service.getAccountExportSnapshot(undefined, SESSION_TOKEN)
    ).rejects.toThrow('Invalid account export subject');
    await expect(
      service.getAccountExportSnapshot('', SESSION_TOKEN)
    ).rejects.toThrow('Invalid account export subject');
    await expect(
      service.getAccountExportSnapshot('not-a-uuid', SESSION_TOKEN)
    ).rejects.toThrow('Invalid account export subject');

    expect(profileRepository.find).not.toHaveBeenCalled();
    expect(timelineRepository.find).not.toHaveBeenCalled();
    expect(activityRepository.find).not.toHaveBeenCalled();
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('reports capped previews as partial and records both preview limits', async () => {
    profileRepository.find.mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `profile-${index}`,
        userId: ACCOUNT_ID,
      }))
    );
    timelineRepository.find.mockResolvedValue([]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data.profiles).toHaveLength(1000);
    expect(snapshot.data.previewLimits).toEqual({
      maxProfiles: 1000,
      maxTimelineEntries: 1000,
      maxStringFieldCharacters: 4096,
      maxSerializedBytes: 512 * 1024,
      truncatedProfiles: true,
      truncatedTimelineEntries: false,
      dataOmittedForBudget: false,
    });
    expect(snapshot.uncovered).toContain('profile-preview-limit-exceeded');
  });

  it('does not select or return inline profile media values', async () => {
    const inlineImage = `data:image/png;base64,${'A'.repeat(200_000)}`;
    profileRepository.find.mockResolvedValue([
      {
        id: 'profile-with-inline-media',
        userId: ACCOUNT_ID,
        appScope: 'global',
        profileName: 'Owner',
        profilePic: inlineImage,
        coverPic: inlineImage,
      },
    ]);
    timelineRepository.find.mockResolvedValue([]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    const select = profileRepository.find.mock.calls[0][0].select;
    expect(select).not.toContain('profilePic');
    expect(select).not.toContain('coverPic');
    expect(JSON.stringify(snapshot)).not.toContain(inlineImage);
    expect(snapshot.data.profiles[0]).not.toHaveProperty('profilePic');
    expect(snapshot.data.profiles[0]).not.toHaveProperty('coverPic');
    expect(snapshot.data.media.inlineMediaExcluded).toBe(true);
    expect(snapshot.uncovered).toContain('inline-profile-media-excluded');
  });

  it('omits snapshot rows when a selected text field exceeds the per-field budget', async () => {
    profileRepository.find.mockResolvedValue([
      {
        id: 'oversized-profile',
        userId: ACCOUNT_ID,
        appScope: 'global',
        profileName: 'x'.repeat(4097),
      },
    ]);
    timelineRepository.find.mockResolvedValue([]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data.profiles).toEqual([]);
    expect(snapshot.data.timelines).toEqual([]);
    expect(
      (
        snapshot.data.previewLimits as typeof snapshot.data.previewLimits & {
          dataOmittedForBudget: boolean;
        }
      ).dataOmittedForBudget
    ).toBe(true);
    expect(snapshot.uncovered).toContain(
      'profile-preview-string-limit-exceeded'
    );
    expect(JSON.stringify(snapshot)).not.toContain('x'.repeat(4097));
  });

  it('omits a many-row snapshot when its serialized response exceeds the byte budget', async () => {
    profileRepository.find.mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `profile-${index}`,
        userId: ACCOUNT_ID,
        appScope: 'global',
        profileName: 'x'.repeat(2048),
      }))
    );
    timelineRepository.find.mockResolvedValue([]);

    const snapshot = await service.getAccountExportSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data.profiles).toEqual([]);
    expect(snapshot.data.timelines).toEqual([]);
    const limits = snapshot.data
      .previewLimits as typeof snapshot.data.previewLimits & {
      dataOmittedForBudget: boolean;
      maxSerializedBytes: number;
    };
    expect(limits.dataOmittedForBudget).toBe(true);
    expect(snapshot.uncovered).toContain(
      'profile-preview-response-budget-exceeded'
    );
    expect(
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8')
    ).toBeLessThanOrEqual(limits.maxSerializedBytes);
  });

  it('sanitizes repository failures at the profile participant boundary', async () => {
    profileRepository.find.mockRejectedValue(
      new Error('database password and SQL statement')
    );

    await expect(
      service.getAccountExportSnapshot(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Profile snapshot unavailable');
  });

  it('denies revoked or wrong-subject sessions before querying profile data', async () => {
    await expect(
      service.getAccountExportSnapshot(ACCOUNT_ID, SESSION_TOKEN)
    ).rejects.toThrow('Invalid account export session');
    authClient.send.mockReturnValueOnce(of({ isValid: false, data: {} }));
    await expect(
      service.getAccountExportSnapshot(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export session');
    authClient.send.mockReturnValueOnce(
      of({ isValid: true, data: { userId: OTHER_ACCOUNT_ID } })
    );
    await expect(
      service.getAccountExportSnapshot(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export session');

    expect(profileRepository.find).not.toHaveBeenCalled();
    expect(timelineRepository.find).not.toHaveBeenCalled();
    expect(activityRepository.find).not.toHaveBeenCalled();
  });
});
