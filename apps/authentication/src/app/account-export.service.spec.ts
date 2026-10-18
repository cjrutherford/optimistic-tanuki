import { of, throwError } from 'rxjs';
import { AccountExportService } from './account-export.service';
import { ACCOUNT_EXPORT_PREVIEW_BUDGETS } from '@optimistic-tanuki/models';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const OTHER_ACCOUNT_ID = 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d';
const SESSION_TOKEN = 'session-bearer-secret';
const identityRow = {
  id: ACCOUNT_ID,
  email: 'owner@example.test',
  firstName: 'Account',
  lastName: 'Owner',
  bio: 'Basic identity',
  ageEligibilityStatus: 'adult',
  ageEligibilityEndsAt: '2025-01-01',
  emailVerifiedAt: new Date('2025-01-01T00:00:00Z'),
  password: 'private-hash',
  totpSecret: 'private-totp',
  keyData: { privateKey: 'private-key-material' },
  oauthProviders: [{ accessToken: 'provider-secret' }],
};

describe('AccountExportService', () => {
  const userRepository = { findOne: jest.fn() };
  const oauthRepository = { find: jest.fn() };
  const permissionRepository = { find: jest.fn() };
  const noticeRepository = { find: jest.fn() };
  const actionRepository = { find: jest.fn() };
  const profileClient = { send: jest.fn() };
  const permissionsClient = { send: jest.fn() };
  const appService = { validateToken: jest.fn() };
  let service: AccountExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue(identityRow);
    oauthRepository.find.mockResolvedValue([]);
    permissionRepository.find.mockResolvedValue([]);
    noticeRepository.find.mockResolvedValue([]);
    actionRepository.find.mockResolvedValue([]);
    profileClient.send.mockReturnValue(
      of({
        contractVersion: 1,
        participantId: 'profile',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: ['guardian-profile-activity', 'profile-media-bytes'],
        data: { profiles: [], timelines: [] },
      })
    );
    permissionsClient.send.mockReturnValue(
      of({
        contractVersion: 1,
        participantId: 'permissions',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: ['profile-id-pages-unfenced'],
        data: { assignments: [] },
      })
    );
    appService.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'client-interface' },
    });
    service = new AccountExportService(
      userRepository as never,
      oauthRepository as never,
      permissionRepository as never,
      noticeRepository as never,
      actionRepository as never,
      profileClient as never,
      permissionsClient as never,
      appService as never
    );
  });

  it('projects guardian permissions and notices by the authenticated role without counterpart identifiers', async () => {
    const guardianId = 'd8e3819c-cf3e-424a-a2a7-8aa412ff5db9';
    permissionRepository.find.mockResolvedValue([
      {
        id: 'dependent-row',
        userId: ACCOUNT_ID,
        guardianUserId: guardianId,
        status: 'approved',
        appId: 'client-interface',
        appName: 'Client',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        attestedAt: new Date('2025-01-02T00:00:00Z'),
        attestationVersion: 'v1',
        dateOfBirth: '2010-01-01',
        applicantEmail: 'dependent@example.test',
        guardianEmail: 'guardian@example.test',
        guardianTokenHash: 'secret-hash',
        attestationText: 'secret statement',
      },
      {
        id: 'guardian-row',
        userId: guardianId,
        guardianUserId: ACCOUNT_ID,
        status: 'approved',
        appId: 'client-interface',
        appName: 'Client',
        createdAt: new Date('2025-02-01T00:00:00Z'),
        attestedAt: new Date('2025-02-02T00:00:00Z'),
        attestationVersion: 'v2',
        dateOfBirth: '2011-01-01',
        applicantEmail: 'other-dependent@example.test',
        guardianEmail: 'owner@example.test',
        resumeTokenHash: 'another-secret-hash',
      },
      {
        id: 'malformed',
        userId: ACCOUNT_ID,
        guardianUserId: ACCOUNT_ID,
        status: 'approved',
      },
      {
        id: 'foreign-row',
        userId: OTHER_ACCOUNT_ID,
        guardianUserId: '59a04d1b-b62f-47d6-91da-a8ecc420c799',
        status: 'approved',
      },
    ]);
    noticeRepository.find.mockResolvedValue([
      {
        guardianUserId: ACCOUNT_ID,
        policyVersion: 'p1',
        policyUrl: 'https://example.test/policy',
        createdAt: new Date('2025-03-01T00:00:00Z'),
        acceptedAt: new Date('2025-03-02T00:00:00Z'),
        status: 'accepted',
        attempts: 5,
        lastFailureCode: 'secret-internal',
      },
    ]);
    actionRepository.find.mockResolvedValue([
      {
        userId: ACCOUNT_ID,
        purpose: 'password-reset',
        appId: 'client-interface',
        createdAt: new Date('2025-03-03T00:00:00Z'),
        consumedAt: null,
        tokenHash: 'action-secret-hash',
        returnPath: '/secret',
        expiresAt: new Date(),
      },
    ]);

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    const data = snapshot.data as Record<string, any>;
    expect(data.guardianPermissions).toEqual([
      expect.objectContaining({
        role: 'dependent',
        dateOfBirth: '2010-01-01',
        attestationVersion: 'v1',
      }),
      expect.objectContaining({ role: 'guardian', attestationVersion: 'v2' }),
    ]);
    expect(data.guardianPermissions[1]).not.toHaveProperty('dateOfBirth');
    expect(data.guardianPolicyNotices[0]).toMatchObject({
      acceptanceMeaning: 'provider-accepted-not-delivered',
    });
    expect(data.authActionMetadata[0]).toMatchObject({
      purpose: 'password-reset',
      appId: 'client-interface',
    });
    expect(snapshot.uncovered).toContain(
      'guardian-permission-malformed-or-self-row'
    );
    expect(snapshot.uncovered).toContain(
      'guardian-permission-ownership-mismatch'
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      new RegExp(
        `${guardianId}|${OTHER_ACCOUNT_ID}|dependent@example.test|guardian@example.test|secret-hash|secret statement|action-secret-hash|/secret|secret-internal`
      )
    );
    expect(permissionRepository.find.mock.calls[0][0].where).toEqual([
      { userId: ACCOUNT_ID },
      { guardianUserId: ACCOUNT_ID },
    ]);
  });

  it('keeps new Auth stores failed, truncated, and over budget visibly partial', async () => {
    permissionRepository.find.mockRejectedValueOnce(
      new Error('database secret')
    );
    noticeRepository.find.mockResolvedValueOnce([]);
    actionRepository.find.mockResolvedValueOnce([]);
    const failed = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(failed.uncovered).toContain('guardian-permissions-read-failed');
    expect(JSON.stringify(failed)).not.toContain('database secret');

    permissionRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, i) => ({
        userId: ACCOUNT_ID,
        guardianUserId: 'd8e3819c-cf3e-424a-a2a7-8aa412ff5db9',
        status: 'approved',
        appId: 'a',
        appName: 'b',
        createdAt: new Date(),
        attestedAt: null,
        attestationVersion: `x${i}`,
      }))
    );
    const truncated = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(truncated.uncovered).toContain(
      'guardian-permissions-preview-limit-exceeded'
    );
    expect(
      (truncated.data as Record<string, any>).guardianPermissions
    ).toHaveLength(1000);
  });

  it('marks notice and action read failures and row truncation independently', async () => {
    noticeRepository.find.mockRejectedValueOnce(new Error('notice SQL secret'));
    actionRepository.find.mockRejectedValueOnce(new Error('action SQL secret'));
    const failed = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(failed.uncovered).toEqual(
      expect.arrayContaining([
        'guardian-policy-notices-read-failed',
        'auth-action-metadata-read-failed',
      ])
    );
    expect(JSON.stringify(failed)).not.toMatch(
      /notice SQL secret|action SQL secret/
    );

    noticeRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, index) => ({
        guardianUserId: ACCOUNT_ID,
        policyVersion: `version-${index}`,
        policyUrl: '/policy',
        createdAt: new Date(),
        acceptedAt: null,
      }))
    );
    actionRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, index) => ({
        userId: ACCOUNT_ID,
        purpose: 'verification',
        appId: `app-${index}`,
        createdAt: new Date(),
        consumedAt: null,
      }))
    );
    const truncated = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(truncated.uncovered).toEqual(
      expect.arrayContaining([
        'guardian-policy-notices-preview-limit-exceeded',
        'auth-action-metadata-preview-limit-exceeded',
      ])
    );
    expect(
      (truncated.data as Record<string, any>).guardianPolicyNotices
    ).toHaveLength(1000);
    expect(
      (truncated.data as Record<string, any>).authActionMetadata
    ).toHaveLength(1000);
  });

  it('applies string and serialized participant budgets to newly added nested Auth metadata', async () => {
    permissionRepository.find.mockResolvedValueOnce([
      {
        userId: ACCOUNT_ID,
        guardianUserId: 'd8e3819c-cf3e-424a-a2a7-8aa412ff5db9',
        status: 'approved',
        appId: 'client-interface',
        appName: 'Client',
        createdAt: new Date(),
        attestedAt: null,
        attestationVersion: 'x'.repeat(4097),
        dateOfBirth: '2010-01-01',
      },
    ]);
    const overString = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(overString.data).toEqual({});
    expect(overString.uncovered).toContain(
      'authentication-preview-string-limit-exceeded'
    );
    expect(JSON.stringify(overString)).not.toContain('x'.repeat(100));

    permissionRepository.find.mockResolvedValueOnce([]);
    actionRepository.find.mockResolvedValueOnce(
      Array.from({ length: 150 }, () => ({
        userId: ACCOUNT_ID,
        purpose: 'verification',
        appId: 'a'.repeat(4096),
        createdAt: new Date(),
        consumedAt: null,
      }))
    );
    const overBytes = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(overBytes.data).toEqual({});
    expect(overBytes.uncovered).toContain(
      'authentication-preview-response-budget-exceeded'
    );
    expect(
      Buffer.byteLength(JSON.stringify(overBytes), 'utf8')
    ).toBeLessThanOrEqual(
      ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes
    );
  });

  it('projects only allowlisted basic identity fields into a visibly partial snapshot', async () => {
    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data.identity).toEqual({
      id: ACCOUNT_ID,
      email: 'owner@example.test',
      firstName: 'Account',
      lastName: 'Owner',
      bio: 'Basic identity',
      ageEligibilityStatus: 'adult',
      ageEligibilityEndsAt: identityRow.ageEligibilityEndsAt,
      emailVerifiedAt: identityRow.emailVerifiedAt,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private-hash|private-totp|private-key-material|provider-secret/
    );
    expect(snapshot.uncovered).toEqual(
      expect.arrayContaining([
        'guardian-permission-unlinked-legacy-rows',
        'guardian-permission-full-attestation-and-lifecycle-fields',
        'guardian-policy-notice-delivery-and-retry-state',
        'auth-action-pruned-history',
        'authentication-security-control-state',
        'session-history',
      ])
    );
    expect(userRepository.findOne.mock.calls[0][0].select).toEqual([
      'id',
      'email',
      'firstName',
      'lastName',
      'bio',
      'emailVerifiedAt',
      'ageEligibilityStatus',
      'ageEligibilityEndsAt',
    ]);
    expect(snapshot.data.oauthProviders).toEqual([]);
    expect(snapshot.data.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'credentials' }),
        expect.objectContaining({ category: 'cryptographic-key-material' }),
        expect.objectContaining({ category: 'security-control-state' }),
      ])
    );
    expect(appService.validateToken).toHaveBeenCalledWith(
      SESSION_TOKEN,
      'client-interface'
    );
  });

  it('exports only selected provider linkage metadata for owned records', async () => {
    oauthRepository.find.mockResolvedValue([
      {
        id: 'owned-provider-id',
        userId: ACCOUNT_ID,
        provider: 'google',
        providerUserId: 'provider-subject-1',
        providerEmail: 'linked@example.test',
        providerDisplayName: 'Linked owner',
        createdAt: new Date('2025-02-01T00:00:00Z'),
        updatedAt: new Date('2025-03-01T00:00:00Z'),
        accessToken: 'raw-provider-token',
        refreshToken: 'raw-refresh-token',
      },
      {
        id: 'foreign-provider-id',
        userId: 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d',
        provider: 'github',
        providerUserId: 'foreign-subject',
      },
    ]);

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(oauthRepository.find).toHaveBeenCalledWith({
      where: { userId: ACCOUNT_ID },
      select: [
        'id',
        'userId',
        'provider',
        'providerUserId',
        'providerEmail',
        'providerDisplayName',
        'createdAt',
        'updatedAt',
      ],
      order: { id: 'ASC' },
      take: 1001,
    });
    expect(snapshot.data.oauthProviders).toEqual([
      {
        id: 'owned-provider-id',
        provider: 'google',
        providerUserId: 'provider-subject-1',
        providerEmail: 'linked@example.test',
        providerDisplayName: 'Linked owner',
        createdAt: new Date('2025-02-01T00:00:00Z'),
        updatedAt: new Date('2025-03-01T00:00:00Z'),
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /raw-provider-token|raw-refresh-token|foreign-subject|foreign-provider-id/
    );
  });

  it('keeps provider failures and provider truncation visibly partial', async () => {
    oauthRepository.find.mockRejectedValueOnce(new Error('database detail'));
    const failed = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(failed.uncovered).toContain('oauth-provider-read-failed');
    expect(JSON.stringify(failed)).not.toContain('database detail');

    oauthRepository.find.mockResolvedValueOnce(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `provider-${index}`,
        userId: ACCOUNT_ID,
        provider: 'google',
        providerUserId: `subject-${index}`,
      }))
    );
    const truncated = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(truncated.data.oauthProviders).toHaveLength(1000);
    expect(truncated.uncovered).toContain(
      'oauth-provider-preview-limit-exceeded'
    );
  });

  it('omits over-budget provider metadata and records the string limit', async () => {
    oauthRepository.find.mockResolvedValue([
      {
        id: 'oversized-provider',
        userId: ACCOUNT_ID,
        provider: 'google',
        providerUserId: 'subject',
        providerDisplayName: 'x'.repeat(
          ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters + 1
        ),
      },
    ]);

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.data).toEqual({});
    expect(snapshot.uncovered).toContain(
      'authentication-preview-string-limit-exceeded'
    );
    expect(JSON.stringify(snapshot)).not.toContain('x'.repeat(100));
  });

  it('omits provider data when the participant byte budget is exceeded', async () => {
    oauthRepository.find.mockResolvedValue(
      Array.from({ length: 1000 }, (_, index) => ({
        id: `provider-${index}`,
        userId: ACCOUNT_ID,
        provider: 'google',
        providerUserId: `subject-${index}`,
        providerEmail: 'x'.repeat(700),
      }))
    );

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.data).toEqual({});
    expect(snapshot.uncovered).toContain(
      'authentication-preview-response-budget-exceeded'
    );
    expect(
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8')
    ).toBeLessThanOrEqual(
      ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes
    );
    expect(JSON.stringify(snapshot)).not.toContain('x'.repeat(100));
  });

  it('omits oversized authentication identity data and records the string budget', async () => {
    userRepository.findOne.mockResolvedValue({
      ...identityRow,
      bio: 'x'.repeat(
        ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters + 1
      ),
    });

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.status).toBe('partial');
    expect(snapshot.data).toEqual({});
    expect(snapshot.uncovered).toContain(
      'authentication-preview-string-limit-exceeded'
    );
    expect(JSON.stringify(snapshot)).not.toContain('x'.repeat(100));
  });

  it('keeps bounded identity data within the participant byte budget', async () => {
    userRepository.findOne.mockResolvedValue({
      ...identityRow,
      firstName: 'x'.repeat(
        ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters
      ),
      lastName: 'y'.repeat(
        ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters
      ),
      bio: 'z'.repeat(ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters),
    });

    const snapshot = await service.getAuthenticationSnapshot(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(snapshot.data).toHaveProperty('identity');
    expect(snapshot.uncovered).not.toContain(
      'authentication-preview-response-budget-exceeded'
    );
    expect(
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8')
    ).toBeLessThanOrEqual(
      ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes
    );
  });

  it('rejects missing or invalid IDs before issuing any repository query', async () => {
    await expect(
      service.getAuthenticationSnapshot(
        undefined,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export subject');
    await expect(
      service.previewAccountExport(
        'not-a-uuid',
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export subject');

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(oauthRepository.find).not.toHaveBeenCalled();
    expect(permissionRepository.find).not.toHaveBeenCalled();
    expect(noticeRepository.find).not.toHaveBeenCalled();
    expect(actionRepository.find).not.toHaveBeenCalled();
    expect(profileClient.send).not.toHaveBeenCalled();
    expect(permissionsClient.send).not.toHaveBeenCalled();
    expect(appService.validateToken).not.toHaveBeenCalled();
  });

  it('rejects missing, revoked, or wrong-subject sessions before reading or forwarding account data', async () => {
    await expect(
      service.previewAccountExport(ACCOUNT_ID, SESSION_TOKEN)
    ).rejects.toThrow('Invalid account export session');
    await expect(
      service.previewAccountExport(ACCOUNT_ID, '', 'client-interface')
    ).rejects.toThrow('Invalid account export session');
    appService.validateToken.mockRejectedValueOnce(new Error('revoked token'));
    await expect(
      service.previewAccountExport(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export session');
    appService.validateToken.mockResolvedValueOnce({
      isValid: true,
      data: { userId: 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d' },
    });
    await expect(
      service.previewAccountExport(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Invalid account export session');

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(oauthRepository.find).not.toHaveBeenCalled();
    expect(permissionRepository.find).not.toHaveBeenCalled();
    expect(noticeRepository.find).not.toHaveBeenCalled();
    expect(actionRepository.find).not.toHaveBeenCalled();
    expect(profileClient.send).not.toHaveBeenCalled();
  });

  it('keeps previews incomplete and records profile-service failures without exposing their errors', async () => {
    profileClient.send.mockReturnValue(
      throwError(() => new Error('postgres password leaked by raw error'))
    );

    const preview = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(preview.complete).toBe(false);
    expect(preview.downloadable).toBe(false);
    expect(preview.status).toBe('EXPORT_INCOMPLETE');
    expect(preview.coverage.blockers).toContain('failed-participant:profile');
    expect(
      preview.participants.find(
        ({ participantId }) => participantId === 'profile'
      )
    ).toMatchObject({
      status: 'failed',
      uncovered: ['participant-unavailable'],
    });
    expect(JSON.stringify(preview)).not.toContain('postgres password');
    expect(JSON.stringify(preview)).not.toContain(SESSION_TOKEN);
    expect(profileClient.send.mock.calls[0][1]).toEqual({
      accountId: ACCOUNT_ID,
      token: SESSION_TOKEN,
      appId: 'client-interface',
    });
  });

  it('turns malformed or cross-account participant replies into sanitized failures', async () => {
    profileClient.send.mockReturnValue(
      of({
        contractVersion: 1,
        participantId: 'profile',
        accountId: 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d',
        status: 'complete',
        uncovered: [],
        data: {},
      })
    );

    const preview = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(preview.coverage.blockers).toContain('failed-participant:profile');
    expect(
      preview.participants.find(
        ({ participantId }) => participantId === 'profile'
      )
    ).toMatchObject({
      status: 'failed',
      uncovered: ['participant-unavailable'],
    });
  });

  it('turns unavailable and cross-account Permissions replies into sanitized failures', async () => {
    permissionsClient.send.mockReturnValueOnce(
      throwError(() => new Error('private database connection details'))
    );
    const unavailable = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(unavailable.coverage.blockers).toContain(
      'failed-participant:permissions'
    );
    expect(JSON.stringify(unavailable)).not.toContain(
      'private database connection details'
    );

    permissionsClient.send.mockReturnValueOnce(
      of({
        contractVersion: 1,
        participantId: 'permissions',
        accountId: OTHER_ACCOUNT_ID,
        status: 'complete',
        uncovered: [],
        data: { assignments: [] },
      })
    );
    const foreign = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(foreign.coverage.blockers).toContain(
      'failed-participant:permissions'
    );
    expect(
      foreign.participants.find(
        ({ participantId }) => participantId === 'permissions'
      )
    ).toMatchObject({
      status: 'failed',
      uncovered: ['participant-unavailable'],
    });
  });

  it('does not echo an unrecognized Permissions marker into the account preview', async () => {
    permissionsClient.send.mockReturnValueOnce(
      of({
        contractVersion: 1,
        participantId: 'permissions',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: [SESSION_TOKEN],
        data: { assignments: [] },
      })
    );
    const preview = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );
    expect(JSON.stringify(preview)).not.toContain(SESSION_TOKEN);
    expect(
      preview.participants.find(
        ({ participantId }) => participantId === 'permissions'
      )
    ).toMatchObject({
      status: 'failed',
      uncovered: ['participant-unavailable'],
    });
  });

  it('omits participant payloads when the combined preview exceeds its byte budget', async () => {
    profileClient.send.mockReturnValue(
      of({
        contractVersion: 1,
        participantId: 'profile',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: [],
        data: { payload: Array.from({ length: 173 }, () => 'x'.repeat(3025)) },
      })
    );
    permissionsClient.send.mockReturnValueOnce(
      of({
        contractVersion: 1,
        participantId: 'permissions',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: [],
        data: { payload: Array.from({ length: 173 }, () => 'y'.repeat(3025)) },
      })
    );

    const preview = await service.previewAccountExport(
      ACCOUNT_ID,
      SESSION_TOKEN,
      'client-interface'
    );

    expect(preview.complete).toBe(false);
    expect(preview.previewLimits.dataOmittedForBudget).toBe(true);
    expect(preview.uncovered).toContain(
      'account-export-preview-response-budget-exceeded'
    );
    expect(
      preview.participants.every(
        ({ data }) => Object.keys(data as object).length === 0
      )
    ).toBe(true);
    expect(
      Buffer.byteLength(JSON.stringify(preview), 'utf8')
    ).toBeLessThanOrEqual(
      ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxCombinedPreviewSerializedBytes
    );
    expect(JSON.stringify(preview)).not.toContain('x'.repeat(100));
  });

  it('sanitizes failures while reading the authentication participant', async () => {
    userRepository.findOne.mockRejectedValue(
      new Error('database password and SQL statement')
    );

    await expect(
      service.getAuthenticationSnapshot(
        ACCOUNT_ID,
        SESSION_TOKEN,
        'client-interface'
      )
    ).rejects.toThrow('Authentication snapshot unavailable');
  });
});
