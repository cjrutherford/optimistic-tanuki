import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AccountExportParticipantSnapshot,
  ACCOUNT_EXPORT_PREVIEW_BUDGETS,
  ACCOUNT_EXPORT_CONTRACT_VERSION,
} from '@optimistic-tanuki/models';
import validator from 'validator';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Profile } from '../profiles/entities/profile.entity';
import { Timeline } from '../timelines/entities/timeline.entity';
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';

const MAX_PREVIEW_RECORDS = 1000;
const AUTH_VALIDATION_TIMEOUT_MS = 3000;
const MAX_PREVIEW_STRING_FIELD_CHARACTERS =
  ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters;
const MAX_PREVIEW_RESPONSE_BYTES =
  ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes;
const PROFILE_SELECT = [
  'id',
  'userId',
  'appScope',
  'profileName',
  'bio',
  'location',
  'occupation',
  'interests',
  'skills',
  'blogRole',
  'created_at',
] as const;
const MAX_ACTIVITY_RECORDS = 1000;
const containsOversizedString = (value: unknown): boolean => {
  if (
    typeof value === 'string' &&
    value.length > MAX_PREVIEW_STRING_FIELD_CHARACTERS
  )
    return true;
  if (Array.isArray(value)) return value.some(containsOversizedString);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.values(value).some(containsOversizedString);
  }
  return false;
};
@Injectable()
export class ProfileAccountExportService {
  constructor(
    @Inject(getRepositoryToken(Profile))
    private readonly profileRepository: Repository<Profile>,
    @Inject(getRepositoryToken(Timeline))
    private readonly timelineRepository: Repository<Timeline>,
    @Inject(getRepositoryToken(GuardianProfileActivity))
    private readonly activityRepository: Repository<GuardianProfileActivity>,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy
  ) {}

  async getAccountExportSnapshot(
    accountId: unknown,
    token: unknown,
    appId?: unknown
  ): Promise<
    AccountExportParticipantSnapshot<{
      profiles: Array<Record<string, unknown>>;
      timelines: Array<Record<string, unknown>>;
      guardianActivity: Array<Record<string, unknown>>;
      media: {
        referencesIncluded: false;
        inlineMediaExcluded: true;
        portableBytesIncluded: false;
      };
      previewLimits: {
        maxProfiles: number;
        maxTimelineEntries: number;
        maxStringFieldCharacters: number;
        maxSerializedBytes: number;
        truncatedProfiles: boolean;
        truncatedTimelineEntries: boolean;
        dataOmittedForBudget: boolean;
      };
    }>
  > {
    if (typeof accountId !== 'string' || !validator.isUUID(accountId, 4)) {
      throw new RpcException('Invalid account export subject');
    }
    await this.assertAuthenticatedSubject(accountId, token, appId);

    let profileRows: Profile[];
    let timelineRows: Timeline[];
    try {
      [profileRows, timelineRows] = await Promise.all([
        this.profileRepository.find({
          where: { userId: accountId },
          select: [...PROFILE_SELECT],
          order: { id: 'ASC' },
          take: MAX_PREVIEW_RECORDS + 1,
        }),
        this.timelineRepository.find({
          where: { userId: accountId },
          select: {
            id: true,
            userId: true,
            title: true,
            description: true,
            timeStamp: true,
            eventType: true,
            related_profile: { id: true, userId: true },
          },
          relations: { related_profile: true },
          order: { id: 'ASC' },
          take: MAX_PREVIEW_RECORDS + 1,
        }),
      ]);
    } catch {
      throw new RpcException('Profile snapshot unavailable');
    }

    // Recheck ownership at the service boundary in case a repository adapter or
    // test double ignores the filter. Reject timelines linked to another user's
    // profile, even when their redundant timeline.userId is malformed.
    const ownedProfiles = profileRows
      .filter((profile) => profile.userId === accountId)
      .slice(0, MAX_PREVIEW_RECORDS);
    const ownedProfileIds = new Set(ownedProfiles.map(({ id }) => id));
    const ownedTimelines = timelineRows
      .filter(
        (timeline) =>
          timeline.userId === accountId &&
          (!timeline.related_profile ||
            (timeline.related_profile.userId === accountId &&
              ownedProfileIds.has(timeline.related_profile.id)))
      )
      .slice(0, MAX_PREVIEW_RECORDS);
    const truncatedProfiles =
      profileRows.filter((profile) => profile.userId === accountId).length >
      MAX_PREVIEW_RECORDS;
    const truncatedTimelineEntries =
      timelineRows.filter((timeline) => timeline.userId === accountId).length >
      MAX_PREVIEW_RECORDS;

    const profiles = ownedProfiles.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      appScope: profile.appScope,
      profileName: profile.profileName,
      bio: profile.bio,
      location: profile.location,
      occupation: profile.occupation,
      interests: profile.interests,
      skills: profile.skills,
      blogRole: profile.blogRole,
      created_at: profile.created_at,
    }));
    const timelines = ownedTimelines.map((timeline) => ({
      id: timeline.id,
      userId: timeline.userId,
      title: timeline.title,
      description: timeline.description,
      timeStamp: timeline.timeStamp,
      eventType: timeline.eventType,
      relatedProfileId: timeline.related_profile?.id ?? null,
    }));
    let activityRows: GuardianProfileActivity[] = [];
    let activityReadFailed = false;
    try {
      activityRows = await this.activityRepository.find({
        where: [{ actorUserId: accountId }, { dependentUserId: accountId }],
        select: [
          'actorUserId',
          'dependentUserId',
          'profileId',
          'appId',
          'operation',
          'changedFieldNames',
          'createdAt',
        ],
        order: { id: 'ASC' },
        take: MAX_ACTIVITY_RECORDS + 1,
      });
    } catch {
      activityReadFailed = true;
    }
    const activityTruncated = activityRows.length > MAX_ACTIVITY_RECORDS;
    const candidateActivities = activityRows.slice(0, MAX_ACTIVITY_RECORDS);
    const relevantActivities = candidateActivities.filter(
      (row) =>
        (row.actorUserId === accountId || row.dependentUserId === accountId) &&
        row.actorUserId !== row.dependentUserId
    );
    const profileOwnerPairs = [
      ...new Map(
        relevantActivities.map((row) => [
          `${row.profileId}:${row.dependentUserId}`,
          { id: row.profileId, userId: row.dependentUserId },
        ])
      ).values(),
    ];
    let verifiedProfileOwners = new Set<string>();
    let profileOwnershipReadFailed = false;
    if (profileOwnerPairs.length > 0) {
      try {
        const ownedActivityProfiles = await this.profileRepository.find({
          where: profileOwnerPairs,
          select: ['id', 'userId'],
        });
        verifiedProfileOwners = new Set(
          ownedActivityProfiles.map(
            (profile) => `${profile.id}:${profile.userId}`
          )
        );
      } catch {
        profileOwnershipReadFailed = true;
      }
    }
    const guardianActivity: Array<Record<string, unknown>> = [];
    let malformedActivity = false;
    let activityOwnerMismatch = false;
    for (const row of candidateActivities) {
      const isDependent = row.dependentUserId === accountId;
      const isGuardian = row.actorUserId === accountId;
      if (
        isDependent === isGuardian ||
        row.actorUserId === row.dependentUserId
      ) {
        malformedActivity = true;
        continue;
      }
      if (
        profileOwnershipReadFailed ||
        !verifiedProfileOwners.has(`${row.profileId}:${row.dependentUserId}`)
      ) {
        activityOwnerMismatch = true;
        continue;
      }
      if (!['profile.view', 'profile.manage'].includes(row.operation)) {
        malformedActivity = true;
        continue;
      }
      guardianActivity.push({
        role: isDependent ? 'dependent' : 'guardian',
        appId: row.appId,
        operation: row.operation,
        createdAt: row.createdAt,
        ...(isDependent
          ? {
              profileId: row.profileId,
              changedFieldNames: row.changedFieldNames,
            }
          : {}),
      });
    }
    const uncovered = [
      'guardian-profile-activity',
      'profile-media-references',
      'profile-media-bytes',
      'inline-profile-media-excluded',
      // TypeORM materializes at most 1001 non-media rows before this projection;
      // future full exports need database pagination/streaming to bound read memory.
      'profile-preview-read-memory-unbounded',
      'guardian-profile-activity-90-day-retention-limits-history',
      ...(activityReadFailed ? ['guardian-profile-activity-read-failed'] : []),
      ...(activityTruncated
        ? ['guardian-profile-activity-preview-limit-exceeded']
        : []),
      ...(profileOwnershipReadFailed
        ? ['guardian-profile-activity-owner-read-failed']
        : []),
      ...(malformedActivity
        ? ['guardian-profile-activity-malformed-or-self-row']
        : []),
      ...(activityOwnerMismatch
        ? ['guardian-profile-activity-owner-mismatch-or-orphan']
        : []),
      ...(truncatedProfiles ? ['profile-preview-limit-exceeded'] : []),
      ...(truncatedTimelineEntries ? ['timeline-preview-limit-exceeded'] : []),
    ];

    const stringLimitExceeded = containsOversizedString({
      profiles,
      timelines,
      guardianActivity,
    });
    let dataOmittedForBudget = stringLimitExceeded;
    if (stringLimitExceeded) {
      uncovered.push('profile-preview-string-limit-exceeded');
    }

    const buildData = (
      omitRows: boolean
    ): {
      profiles: Array<Record<string, unknown>>;
      timelines: Array<Record<string, unknown>>;
      guardianActivity: Array<Record<string, unknown>>;
      media: {
        referencesIncluded: false;
        inlineMediaExcluded: true;
        portableBytesIncluded: false;
      };
      previewLimits: {
        maxProfiles: number;
        maxTimelineEntries: number;
        maxStringFieldCharacters: number;
        maxSerializedBytes: number;
        truncatedProfiles: boolean;
        truncatedTimelineEntries: boolean;
        dataOmittedForBudget: boolean;
      };
    } => ({
      profiles: omitRows ? [] : profiles,
      timelines: omitRows ? [] : timelines,
      guardianActivity: omitRows ? [] : guardianActivity,
      media: {
        referencesIncluded: false,
        inlineMediaExcluded: true,
        portableBytesIncluded: false,
      },
      previewLimits: {
        maxProfiles: MAX_PREVIEW_RECORDS,
        maxTimelineEntries: MAX_PREVIEW_RECORDS,
        maxStringFieldCharacters: MAX_PREVIEW_STRING_FIELD_CHARACTERS,
        maxSerializedBytes: MAX_PREVIEW_RESPONSE_BYTES,
        truncatedProfiles,
        truncatedTimelineEntries,
        dataOmittedForBudget: omitRows,
      },
    });

    let data = buildData(dataOmittedForBudget);
    const snapshot = {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'profile' as const,
      accountId,
      status: 'partial' as const,
      uncovered,
      data,
    };
    if (
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8') >
      MAX_PREVIEW_RESPONSE_BYTES
    ) {
      dataOmittedForBudget = true;
      if (!uncovered.includes('profile-preview-response-budget-exceeded')) {
        uncovered.push('profile-preview-response-budget-exceeded');
      }
      data = buildData(true);
    }

    return {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'profile',
      accountId,
      status: 'partial',
      uncovered,
      data,
    };
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
    let validation: {
      isValid?: boolean;
      data?: { userId?: string };
    };
    try {
      validation = await firstValueFrom(
        this.authClient
          .send(
            { cmd: AuthCommands.Validate },
            { token, userId: accountId, appId }
          )
          .pipe(timeout({ first: AUTH_VALIDATION_TIMEOUT_MS }))
      );
    } catch {
      throw new RpcException('Invalid account export session');
    }
    if (validation?.isValid !== true || validation.data?.userId !== accountId) {
      throw new RpcException('Invalid account export session');
    }
  }
}
