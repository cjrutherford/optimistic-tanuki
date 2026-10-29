import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AccountExportCompleteness,
  AccountExportParticipantSnapshot,
  AccountExportPreview,
  ACCOUNT_EXPORT_CONTRACT_VERSION,
  ACCOUNT_EXPORT_PREVIEW_BUDGETS,
  evaluateAccountExportCompleteness,
} from '@optimistic-tanuki/models';
import {
  PermissionCommands,
  ProfileCommands,
  SocialCommands,
  ForumCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import validator from 'validator';
import { Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { GuardianPermissionEntity } from '../guardian-permissions/entities/guardian-permission.entity';
import { GuardianPolicyNoticeEntity } from '../guardian-permissions/entities/guardian-policy-notice.entity';
import { AuthActionTokenEntity } from '../email-auth/entities/auth-action-token.entity';
import { AppService } from './app.service';

const PROFILE_RPC_TIMEOUT_MS = 3000;
const FORUM_RPC_TIMEOUT_MS = 16000;
const MAX_STRING_FIELD_CHARACTERS =
  ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters;
const MAX_PARTICIPANT_BYTES =
  ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes;
const PERMISSIONS_UNCOVERED_MARKERS = new Set([
  'permissions-role-assignment-preview',
  'profile-id-pages-unfenced',
  'shared-role-scope-permission-definitions-uncovered',
  'target-resources-uncovered',
  'profile-id-page-invalid',
  'role-assignment-read-failed',
  'profile-or-assignment-row-malformed-or-foreign',
  'profile-id-preview-limit-exceeded',
  'role-assignment-preview-limit-exceeded',
  'permission-preview-time-budget-exceeded',
  'permission-preview-string-limit-exceeded',
  'permission-preview-response-budget-exceeded',
  'permission-preview-data-omitted-for-budget',
]);
const MAX_COMBINED_PREVIEW_BYTES =
  ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxCombinedPreviewSerializedBytes;
const IDENTITY_FIELDS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'bio',
  'emailVerifiedAt',
  'ageEligibilityStatus',
  'ageEligibilityEndsAt',
] as const;
const OAUTH_PROVIDER_FIELDS = [
  'id',
  'userId',
  'provider',
  'providerUserId',
  'providerEmail',
  'providerDisplayName',
  'createdAt',
  'updatedAt',
] as const;
const MAX_PROVIDER_RECORDS = 1000;
const MAX_ACCOUNT_RECORDS = 1000;
const SOCIAL_UNCOVERED_MARKERS = new Set([
  'social-preview-unfenced',
  'social-components-unreviewed',
  'post-link-urls-omitted',
  'social-poll-vote-history-uncovered',
  'poll-post-association-unverified',
  'social-account-profile-selection-ambiguous',
  'social-legacy-guardian-ownership-unverified',
  'attachment-file-references-omitted',
  'portable-media-bytes-not-included',
  'social-activity-uncovered',
  'social-user-presence-uncovered',
  'social-profile-view-uncovered',
  'social-notification-uncovered',
  'social-post-share-uncovered',
  'social-event-uncovered',
  'social-community-uncovered',
  'social-community-member-uncovered',
  'social-community-invite-uncovered',
  'social-community-membership-audit-uncovered',
  'social-community-election-uncovered',
  'social-election-candidate-uncovered',
  'social-election-vote-uncovered',
  'social-business-page-content-uncovered',
  'social-business-theme-content-uncovered',
  'social-community-sponsorship-content-uncovered',
  'social-guardian-content-audit-uncovered',
  'social-guardian-published-asset-grant-uncovered',
  'social-content-report-uncovered',
  'social-content-moderation-action-uncovered',
  'profile-id-preview-limit-exceeded',
  'profile-id-resolution-failed',
  'social-read-time-budget-exceeded',
  'posts-preview-limit-exceeded',
  'posts-read-failed',
  'posts-owner-mismatch',
  'posts-malformed-or-duplicate-row',
  'comments-preview-limit-exceeded',
  'comments-read-failed',
  'comments-owner-mismatch',
  'comments-malformed-or-duplicate-row',
  'comments-orphan-or-malformed-relation',
  'foreign-parent-comment-reference-omitted',
  'reactions-preview-limit-exceeded',
  'reactions-read-failed',
  'reactions-owner-mismatch',
  'reactions-malformed-or-duplicate-row',
  'post-target-existence-read-failed',
  'comment-target-existence-read-failed',
  'reactions-ambiguous-or-orphan-target',
  'reactions-orphan-target',
  'reactions-owner-or-target-mismatch',
  'votes-preview-limit-exceeded',
  'votes-read-failed',
  'votes-owner-mismatch',
  'votes-malformed-or-duplicate-row',
  'votes-ambiguous-or-orphan-target',
  'votes-orphan-target',
  'votes-owner-or-target-mismatch',
  'attachments-preview-limit-exceeded',
  'attachments-read-failed',
  'attachments-owner-or-row-malformed',
  'attachments-repeated-cursor',
  'polls-preview-limit-exceeded',
  'polls-read-failed',
  'polls-owner-mismatch',
  'polls-malformed-or-duplicate-row',
  'poll-owner-or-row-malformed',
  'polls-repeated-cursor',
  'social-preview-string-limit-exceeded',
  'social-preview-response-budget-exceeded',
  'posts-repeated-cursor',
  'comments-repeated-cursor',
  'reactions-repeated-cursor',
  'votes-repeated-cursor',
  'saved-items-preview-limit-exceeded',
  'saved-items-read-failed',
  'saved-items-owner-mismatch',
  'saved-items-malformed-or-duplicate-row',
  'saved-items-repeated-cursor',
  'search-history-preview-limit-exceeded',
  'search-history-read-failed',
  'search-history-owner-mismatch',
  'search-history-malformed-or-duplicate-row',
  'search-history-repeated-cursor',
  'follows-preview-limit-exceeded',
  'follows-read-failed',
  'follows-owner-mismatch',
  'follows-malformed-or-duplicate-row',
  'follows-repeated-cursor',
  'blocks-preview-limit-exceeded',
  'blocks-read-failed',
  'blocks-owner-mismatch',
  'blocks-malformed-or-duplicate-row',
  'blocks-repeated-cursor',
  'mutes-preview-limit-exceeded',
  'mutes-read-failed',
  'mutes-owner-mismatch',
  'mutes-malformed-or-duplicate-row',
  'mutes-repeated-cursor',
]);
const FORUM_UNCOVERED_MARKERS = new Set([
  'forum-preview-unfenced',
  'forum-links-unreviewed',
  'forum-reports-and-moderation-uncovered',
  'forum-media-references-unresolved',
  'embedded-media-and-link-references-unresolved',
  'forum-legacy-authorship-provenance-unverified',
  'profile-id-preview-limit-exceeded',
  'profile-id-resolution-failed',
  'forum-read-time-budget-exceeded',
  'topics-preview-limit-exceeded',
  'topics-read-failed',
  'topics-owner-mismatch',
  'topics-malformed-or-duplicate-row',
  'topics-repeated-cursor',
  'threads-preview-limit-exceeded',
  'threads-read-failed',
  'threads-owner-mismatch',
  'threads-malformed-or-duplicate-row',
  'threads-repeated-cursor',
  'posts-preview-limit-exceeded',
  'posts-read-failed',
  'posts-owner-mismatch',
  'posts-malformed-or-duplicate-row',
  'posts-repeated-cursor',
  'forum-preview-string-limit-exceeded',
  'forum-preview-response-budget-exceeded',
  'forum-preview-data-omitted-for-budget',
]);
const containsOversizedString = (value: unknown): boolean => {
  if (typeof value === 'string')
    return value.length > MAX_STRING_FIELD_CHARACTERS;
  if (Array.isArray(value)) return value.some(containsOversizedString);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.values(value).some(containsOversizedString);
  }
  return false;
};

@Injectable()
export class AccountExportService {
  constructor(
    @Inject(getRepositoryToken(UserEntity))
    private readonly userRepository: Repository<UserEntity>,
    @Inject(getRepositoryToken(OAuthProviderEntity))
    private readonly oauthRepository: Repository<OAuthProviderEntity>,
    @Inject(getRepositoryToken(GuardianPermissionEntity))
    private readonly permissionRepository: Repository<GuardianPermissionEntity>,
    @Inject(getRepositoryToken(GuardianPolicyNoticeEntity))
    private readonly noticeRepository: Repository<GuardianPolicyNoticeEntity>,
    @Inject(getRepositoryToken(AuthActionTokenEntity))
    private readonly actionRepository: Repository<AuthActionTokenEntity>,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.FORUM_SERVICE)
    private readonly forumClient: ClientProxy,
    private readonly appService: AppService
  ) {}

  async getAuthenticationSnapshot(
    accountId: unknown,
    token: unknown,
    appId?: unknown
  ): Promise<
    AccountExportParticipantSnapshot<{
      identity: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        bio: string;
        emailVerifiedAt: Date | null;
        ageEligibilityStatus: string;
        ageEligibilityEndsAt: string | null;
      };
      oauthProviders: Array<Record<string, unknown>>;
      guardianPermissions: Array<Record<string, unknown>>;
      guardianPolicyNotices: Array<Record<string, unknown>>;
      authActionMetadata: Array<Record<string, unknown>>;
      excluded: Array<{ category: string; reason: string }>;
    }>
  > {
    this.assertAccountId(accountId);
    await this.assertAuthenticatedSubject(accountId, token, appId);
    let user: UserEntity | null;
    try {
      user = await this.userRepository.findOne({
        where: { id: accountId },
        select: [...IDENTITY_FIELDS],
      });
    } catch {
      throw new RpcException('Authentication snapshot unavailable');
    }
    if (!user) throw new RpcException('Account export subject not found');

    let providerRows: OAuthProviderEntity[] = [];
    let providerReadFailed = false;
    try {
      providerRows = await this.oauthRepository.find({
        where: { userId: accountId },
        select: [...OAUTH_PROVIDER_FIELDS],
        order: { id: 'ASC' },
        take: MAX_PROVIDER_RECORDS + 1,
      });
    } catch {
      providerReadFailed = true;
    }
    const foreignProviderRows = providerRows.some(
      (provider) => provider.userId !== accountId
    );
    const accountProviderRows = providerRows.filter(
      (provider) => provider.userId === accountId
    );
    const truncatedProviders =
      accountProviderRows.length > MAX_PROVIDER_RECORDS;
    const oauthProviders = accountProviderRows
      .slice(0, MAX_PROVIDER_RECORDS)
      .map((provider) => ({
        id: provider.id,
        provider: provider.provider,
        providerUserId: provider.providerUserId,
        providerEmail: provider.providerEmail ?? null,
        providerDisplayName: provider.providerDisplayName ?? null,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      }));

    const uncovered: string[] = [
      'authentication-security-control-state',
      'session-history',
      'auth-action-pruned-history',
      'active-auth-action-token-details-excluded',
      'guardian-permission-full-attestation-and-lifecycle-fields',
      'guardian-permission-unlinked-legacy-rows',
      'guardian-policy-notice-delivery-and-retry-state',
    ];
    const readBounded = async <T>(
      label: string,
      read: () => Promise<T[]>
    ): Promise<T[]> => {
      try {
        const rows = await read();
        if (rows.length > MAX_ACCOUNT_RECORDS) {
          uncovered.push(`${label}-preview-limit-exceeded`);
        }
        return rows.slice(0, MAX_ACCOUNT_RECORDS);
      } catch {
        uncovered.push(`${label}-read-failed`);
        return [];
      }
    };
    const permissionRows = await readBounded('guardian-permissions', () =>
      this.permissionRepository.find({
        where: [{ userId: accountId }, { guardianUserId: accountId }],
        select: [
          'id',
          'userId',
          'guardianUserId',
          'status',
          'appId',
          'appName',
          'createdAt',
          'attestedAt',
          'attestationVersion',
          'dateOfBirth',
        ],
        order: { id: 'ASC' },
        take: MAX_ACCOUNT_RECORDS + 1,
      })
    );
    const guardianPermissions: Array<Record<string, unknown>> = [];
    let malformedPermission = false;
    let permissionOwnershipMismatch = false;
    for (const row of permissionRows) {
      const dependent = row.userId === accountId;
      const guardian = row.guardianUserId === accountId;
      if (!dependent && !guardian) {
        permissionOwnershipMismatch = true;
        continue;
      }
      if (
        dependent === guardian ||
        (dependent && !row.guardianUserId) ||
        (guardian && !row.userId) ||
        ![
          'pending',
          'approved',
          'revoked',
          'expired',
          'adult-challenge',
        ].includes(row.status)
      ) {
        malformedPermission = true;
        continue;
      }
      guardianPermissions.push({
        role: dependent ? 'dependent' : 'guardian',
        status: row.status,
        appId: row.appId,
        appName: row.appName,
        createdAt: row.createdAt,
        attestedAt: row.attestedAt ?? null,
        attestationVersion: row.attestationVersion ?? null,
        ...(dependent ? { dateOfBirth: row.dateOfBirth ?? null } : {}),
      });
    }
    if (malformedPermission) {
      uncovered.push('guardian-permission-malformed-or-self-row');
    }
    if (permissionOwnershipMismatch) {
      uncovered.push('guardian-permission-ownership-mismatch');
    }

    const noticeRows = await readBounded('guardian-policy-notices', () =>
      this.noticeRepository.find({
        where: { guardianUserId: accountId },
        select: [
          'guardianUserId',
          'policyVersion',
          'policyUrl',
          'createdAt',
          'acceptedAt',
        ],
        order: { createdAt: 'ASC' },
        take: MAX_ACCOUNT_RECORDS + 1,
      })
    );
    const guardianPolicyNotices = noticeRows
      .filter((row) => row.guardianUserId === accountId)
      .map((row) => ({
        policyVersion: row.policyVersion,
        policyUrl: row.policyUrl,
        createdAt: row.createdAt,
        acceptedAt: row.acceptedAt ?? null,
        acceptanceMeaning: 'provider-accepted-not-delivered',
      }));
    if (noticeRows.some((row) => row.guardianUserId !== accountId)) {
      uncovered.push('guardian-policy-notice-ownership-mismatch');
    }

    const actionRows = await readBounded('auth-action-metadata', () =>
      this.actionRepository.find({
        where: { userId: accountId },
        select: ['userId', 'purpose', 'appId', 'createdAt', 'consumedAt'],
        order: { id: 'ASC' },
        take: MAX_ACCOUNT_RECORDS + 1,
      })
    );
    const authActionMetadata = actionRows
      .filter((row) => row.userId === accountId)
      .map((row) => ({
        purpose: row.purpose,
        appId: row.appId,
        createdAt: row.createdAt,
        consumedAt: row.consumedAt ?? null,
      }));
    if (actionRows.some((row) => row.userId !== accountId)) {
      uncovered.push('auth-action-metadata-ownership-mismatch');
    }

    const identity = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      ageEligibilityStatus: user.ageEligibilityStatus,
      ageEligibilityEndsAt: user.ageEligibilityEndsAt ?? null,
    };
    const snapshot: AccountExportParticipantSnapshot<{
      identity: typeof identity;
      oauthProviders: typeof oauthProviders;
      guardianPermissions: typeof guardianPermissions;
      guardianPolicyNotices: typeof guardianPolicyNotices;
      authActionMetadata: typeof authActionMetadata;
      excluded: Array<{ category: string; reason: string }>;
    }> = {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'authentication',
      accountId,
      status: 'partial',
      uncovered: [
        ...uncovered,
        ...(providerReadFailed ? ['oauth-provider-read-failed'] : []),
        ...(truncatedProviders
          ? ['oauth-provider-preview-limit-exceeded']
          : []),
        ...(foreignProviderRows ? ['oauth-provider-ownership-mismatch'] : []),
      ],
      data: {
        identity,
        oauthProviders,
        guardianPermissions,
        guardianPolicyNotices,
        authActionMetadata,
        excluded: [
          {
            category: 'credentials',
            reason:
              'Passwords, TOTP secrets, session tokens, action tokens, and provider credentials are excluded.',
          },
          {
            category: 'cryptographic-key-material',
            reason: 'Private key material and key metadata are excluded.',
          },
          {
            category: 'security-control-state',
            reason:
              'Login lock and failure counters are operational security state.',
          },
        ],
      },
    };
    const hasOversizedString = containsOversizedString({
      identity,
      oauthProviders,
      guardianPermissions,
      guardianPolicyNotices,
      authActionMetadata,
    });
    if (hasOversizedString) {
      snapshot.uncovered.push('authentication-preview-string-limit-exceeded');
      snapshot.data = {} as typeof snapshot.data;
    }
    if (
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8') >
      MAX_PARTICIPANT_BYTES
    ) {
      snapshot.uncovered.push(
        'authentication-preview-response-budget-exceeded'
      );
      snapshot.data = {} as typeof snapshot.data;
    }
    return snapshot;
  }

  async previewAccountExport(
    accountId: unknown,
    token: unknown,
    appId?: unknown
  ): Promise<AccountExportPreview> {
    this.assertAccountId(accountId);
    const authentication = await this.getAuthenticationSnapshot(
      accountId,
      token,
      appId
    );
    let profile: AccountExportParticipantSnapshot;
    try {
      const response = await firstValueFrom(
        this.profileClient
          .send(
            { cmd: ProfileCommands.GetAccountExportSnapshot },
            { accountId, token, appId }
          )
          .pipe(timeout({ first: PROFILE_RPC_TIMEOUT_MS }))
      );
      if (
        !response ||
        response.contractVersion !== ACCOUNT_EXPORT_CONTRACT_VERSION ||
        response.participantId !== 'profile' ||
        response.accountId !== accountId ||
        !['complete', 'partial', 'failed'].includes(response.status) ||
        !Array.isArray(response.uncovered) ||
        typeof response.data !== 'object' ||
        response.data === null
      ) {
        throw new Error('invalid participant response');
      }
      profile = response as AccountExportParticipantSnapshot;
    } catch {
      profile = {
        contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
        participantId: 'profile',
        accountId,
        status: 'failed',
        uncovered: ['participant-unavailable'],
        data: {},
      };
    }

    const participants = [authentication, profile];
    let permissions: AccountExportParticipantSnapshot;
    try {
      const response = await firstValueFrom(
        this.permissionsClient
          .send(
            { cmd: PermissionCommands.GetAccountExportSnapshot },
            { accountId, token, appId }
          )
          .pipe(timeout({ first: PROFILE_RPC_TIMEOUT_MS }))
      );
      if (
        !response ||
        response.contractVersion !== ACCOUNT_EXPORT_CONTRACT_VERSION ||
        response.participantId !== 'permissions' ||
        response.accountId !== accountId ||
        response.status !== 'partial' ||
        !Array.isArray(response.uncovered) ||
        !response.uncovered.every(
          (marker: unknown) =>
            typeof marker === 'string' &&
            PERMISSIONS_UNCOVERED_MARKERS.has(marker)
        ) ||
        typeof response.data !== 'object' ||
        response.data === null
      )
        throw new Error('invalid participant response');
      permissions = response as AccountExportParticipantSnapshot;
      if (
        containsOversizedString(permissions.data) ||
        Buffer.byteLength(JSON.stringify(permissions), 'utf8') >
          MAX_PARTICIPANT_BYTES
      ) {
        permissions = {
          contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
          participantId: 'permissions',
          accountId,
          status: 'partial',
          uncovered: [
            ...permissions.uncovered,
            'participant-payload-omitted-for-budget',
          ],
          data: {},
        };
      }
    } catch {
      permissions = {
        contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
        participantId: 'permissions',
        accountId,
        status: 'failed',
        uncovered: ['participant-unavailable'],
        data: {},
      };
    }
    participants.push(permissions);
    let social: AccountExportParticipantSnapshot;
    try {
      const response = await firstValueFrom(
        this.socialClient
          .send(
            { cmd: SocialCommands.GetAccountExportSnapshot },
            { accountId, token, appId }
          )
          .pipe(timeout({ first: PROFILE_RPC_TIMEOUT_MS }))
      );
      if (
        !response ||
        response.contractVersion !== ACCOUNT_EXPORT_CONTRACT_VERSION ||
        response.participantId !== 'social' ||
        response.accountId !== accountId ||
        response.status !== 'partial' ||
        !Array.isArray(response.uncovered) ||
        !response.uncovered.every(
          (marker: unknown) =>
            typeof marker === 'string' && SOCIAL_UNCOVERED_MARKERS.has(marker)
        ) ||
        typeof response.data !== 'object' ||
        response.data === null
      )
        throw new Error('invalid social participant response');
      social = response as AccountExportParticipantSnapshot;
      if (
        containsOversizedString(social.data) ||
        Buffer.byteLength(JSON.stringify(social), 'utf8') >
          MAX_PARTICIPANT_BYTES
      ) {
        social = {
          contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
          participantId: 'social',
          accountId,
          status: 'partial',
          uncovered: [
            ...social.uncovered,
            'participant-payload-omitted-for-budget',
          ],
          data: {},
        };
      }
    } catch {
      social = {
        contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
        participantId: 'social',
        accountId,
        status: 'failed',
        uncovered: ['participant-unavailable'],
        data: {},
      };
    }
    participants.push(social);
    let forum: AccountExportParticipantSnapshot;
    try {
      const response = await firstValueFrom(
        this.forumClient
          .send(
            { cmd: ForumCommands.GetAccountExportSnapshot },
            { accountId, token, appId }
          )
          .pipe(timeout({ first: FORUM_RPC_TIMEOUT_MS }))
      );
      if (
        !response ||
        response.contractVersion !== ACCOUNT_EXPORT_CONTRACT_VERSION ||
        response.participantId !== 'forum' ||
        response.accountId !== accountId ||
        response.status !== 'partial' ||
        !Array.isArray(response.uncovered) ||
        !response.uncovered.every(
          (marker: unknown) =>
            typeof marker === 'string' && FORUM_UNCOVERED_MARKERS.has(marker)
        ) ||
        typeof response.data !== 'object' ||
        response.data === null ||
        Array.isArray(response.data)
      ) {
        throw new Error('invalid Forum participant response');
      }
      forum = response as AccountExportParticipantSnapshot;
      if (
        containsOversizedString(forum.data) ||
        Buffer.byteLength(JSON.stringify(forum), 'utf8') > MAX_PARTICIPANT_BYTES
      ) {
        forum = {
          contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
          participantId: 'forum',
          accountId,
          status: 'partial',
          uncovered: [
            ...forum.uncovered,
            'participant-payload-omitted-for-budget',
          ],
          data: {},
        };
      }
    } catch {
      forum = {
        contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
        participantId: 'forum',
        accountId,
        status: 'failed',
        uncovered: ['participant-unavailable'],
        data: {},
      };
    }
    participants.push(forum);
    let uncovered: string[] = [];
    let dataOmittedForBudget = false;
    let preview = {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      accountId,
      complete: false as const,
      status: 'EXPORT_INCOMPLETE' as const,
      downloadable: false as const,
      coverage: evaluateAccountExportCompleteness(participants, accountId),
      participants,
      uncovered,
      previewLimits: {
        maxSerializedBytes: MAX_COMBINED_PREVIEW_BYTES,
        dataOmittedForBudget,
      },
    };
    if (
      Buffer.byteLength(JSON.stringify(preview), 'utf8') >
      MAX_COMBINED_PREVIEW_BYTES
    ) {
      dataOmittedForBudget = true;
      uncovered = ['account-export-preview-response-budget-exceeded'];
      preview = {
        ...preview,
        participants: participants.map((participant) => ({
          contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
          participantId: participant.participantId,
          accountId,
          status: 'partial',
          uncovered: ['participant-payload-omitted-for-preview-budget'],
          data: {},
        })),
        uncovered,
        previewLimits: {
          maxSerializedBytes: MAX_COMBINED_PREVIEW_BYTES,
          dataOmittedForBudget,
        },
      };
    }
    return preview;
  }

  private assertAccountId(accountId: unknown): asserts accountId is string {
    if (typeof accountId !== 'string' || !validator.isUUID(accountId, 4)) {
      throw new RpcException('Invalid account export subject');
    }
  }

  private async assertAuthenticatedSubject(
    accountId: string,
    token: unknown,
    appId: unknown
  ): Promise<void> {
    if (
      typeof token !== 'string' ||
      token.trim().length === 0 ||
      typeof appId !== 'string' ||
      appId.trim().length === 0
    ) {
      throw new RpcException('Invalid account export session');
    }
    let validation: Awaited<ReturnType<AppService['validateToken']>>;
    try {
      validation = await this.appService.validateToken(token, appId as string);
    } catch {
      throw new RpcException('Invalid account export session');
    }
    if (validation?.isValid !== true || validation.data?.userId !== accountId) {
      throw new RpcException('Invalid account export session');
    }
  }
}
