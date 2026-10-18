import { of, throwError } from 'rxjs';
import { AccountExportService } from './account-export.service';
import { ACCOUNT_EXPORT_PREVIEW_BUDGETS } from '@optimistic-tanuki/models';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
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
  const profileClient = { send: jest.fn() };
  const appService = { validateToken: jest.fn() };
  let service: AccountExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue(identityRow);
    oauthRepository.find.mockResolvedValue([]);
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
    appService.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'client-interface' },
    });
    service = new AccountExportService(
      userRepository as never,
      oauthRepository as never,
      profileClient as never,
      appService as never
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
        'guardian-permissions',
        'guardian-policy-notices',
        'auth-action-token-security-history',
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
    expect(profileClient.send).not.toHaveBeenCalled();
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

  it('omits participant payloads when the combined preview exceeds its byte budget', async () => {
    profileClient.send.mockReturnValue(
      of({
        contractVersion: 1,
        participantId: 'profile',
        accountId: ACCOUNT_ID,
        status: 'partial',
        uncovered: [],
        data: {
          payload: 'x'.repeat(
            ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxCombinedPreviewSerializedBytes
          ),
        },
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
