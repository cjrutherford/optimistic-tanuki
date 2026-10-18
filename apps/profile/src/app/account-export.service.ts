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
  'created_at',
] as const;
@Injectable()
export class ProfileAccountExportService {
  constructor(
    @Inject(getRepositoryToken(Profile))
    private readonly profileRepository: Repository<Profile>,
    @Inject(getRepositoryToken(Timeline))
    private readonly timelineRepository: Repository<Timeline>,
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
    const uncovered = [
      'guardian-profile-activity',
      'profile-media-references',
      'profile-media-bytes',
      'inline-profile-media-excluded',
      // TypeORM materializes at most 1001 non-media rows before this projection;
      // future full exports need database pagination/streaming to bound read memory.
      'profile-preview-read-memory-unbounded',
      ...(truncatedProfiles ? ['profile-preview-limit-exceeded'] : []),
      ...(truncatedTimelineEntries ? ['timeline-preview-limit-exceeded'] : []),
    ];

    const stringLimitExceeded = [...profiles, ...timelines].some((record) =>
      Object.values(record).some(
        (value) =>
          typeof value === 'string' &&
          value.length > MAX_PREVIEW_STRING_FIELD_CHARACTERS
      )
    );
    let dataOmittedForBudget = stringLimitExceeded;
    if (stringLimitExceeded) {
      uncovered.push('profile-preview-string-limit-exceeded');
    }

    const buildData = (
      omitRows: boolean
    ): {
      profiles: Array<Record<string, unknown>>;
      timelines: Array<Record<string, unknown>>;
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
