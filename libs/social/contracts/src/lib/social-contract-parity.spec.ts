import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  CommunityCommands,
  BusinessContentCommands,
  SocialEventCommands,
  FollowCommands,
  PollCommands,
  PostCommands,
  PostShareCommands,
  PresenceCommands,
} from '../index';
import {
  BusinessPageRefDto,
  CreateBusinessPageContentDto,
  CreateBusinessThemeDto,
  BusinessThemeRefDto,
  CommunitiesPagesDto,
  UpdateBusinessPageContentDto,
} from './business-page';
import {
  CommunitySponsorshipsDto,
  CreateSponsorshipContentDto,
  UserSponsorshipsDto,
} from './sponsorship';
import {
  CommunityDto,
  CommunityRefDto,
  CreateCommunityDto,
  JoinCommunityDto,
  LeaveCommunityDto,
} from './community';
import {
  CreateSocialEventDto,
  SocialEventDto,
  SocialEventPrivacy,
  SocialEventRefDto,
  SocialEventStatus,
} from './social-event';
import { FollowGraphDto, FollowUserDto, UnfollowUserDto } from './follow';
import {
  CreatePollDto,
  GetPresenceDto,
  PresenceStatus,
  SetPresenceDto,
  SharePostDto,
  VotePollDto,
} from './interaction';
import {
  CreateSocialPostDto,
  SocialPostDto,
  SocialPostRefDto,
} from './social-post';

const validPost = {
  title: 'Hello',
  content: 'World',
  profileId: 'profile-1',
  userId: 'user-1',
};

const validEvent = {
  title: 'Meetup',
  startDate: '2026-10-01T18:00:00.000Z',
};

/**
 * Covered patterns with their contract DTO plus one valid and one invalid
 * sample. Everything else in the touched command objects is named in
 * DEFERRED_KEYS; untouched command objects (votes, reactions, comments,
 * attachments, links, notifications, search, privacy, activity, saved items,
 * analytics, scheduled posts, realtime) are follow-up slices named in the
 * README, not enumerated here.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: PostCommands.CREATE,
    dto: CreateSocialPostDto,
    valid: validPost,
    invalid: { title: 'Hello' },
    invalidProps: ['content', 'profileId', 'userId'],
  },
  {
    pattern: PostCommands.FIND,
    dto: SocialPostRefDto,
    valid: { postId: 'post-1' },
    invalid: {},
    invalidProps: ['postId'],
  },
  {
    pattern: CommunityCommands.CREATE,
    dto: CreateCommunityDto,
    valid: { name: 'North Star', ownerId: 'profile-1' },
    invalid: { name: 'North Star' },
    invalidProps: ['ownerId'],
  },
  {
    pattern: CommunityCommands.FIND,
    dto: CommunityRefDto,
    valid: { communityId: 'community-1' },
    invalid: {},
    invalidProps: ['communityId'],
  },
  {
    pattern: CommunityCommands.JOIN,
    dto: JoinCommunityDto,
    valid: { communityId: 'community-1', profileId: 'profile-1' },
    invalid: { communityId: 'community-1' },
    invalidProps: ['profileId'],
  },
  {
    pattern: CommunityCommands.LEAVE,
    dto: LeaveCommunityDto,
    valid: { communityId: 'community-1', profileId: 'profile-1' },
    invalid: { profileId: 'profile-1' },
    invalidProps: ['communityId'],
  },
  {
    pattern: FollowCommands.FOLLOW,
    dto: FollowUserDto,
    valid: { followerId: 'profile-1', followeeId: 'profile-2' },
    invalid: { followerId: 'profile-1' },
    invalidProps: ['followeeId'],
  },
  {
    pattern: FollowCommands.UNFOLLOW,
    dto: UnfollowUserDto,
    valid: { followerId: 'profile-1', followeeId: 'profile-2' },
    invalid: { followeeId: 'profile-2' },
    invalidProps: ['followerId'],
  },
  {
    pattern: PollCommands.CREATE,
    dto: CreatePollDto,
    valid: {
      question: 'Best day?',
      options: ['Mon', 'Fri'],
      profileId: 'profile-1',
      userId: 'user-1',
    },
    invalid: { question: 'Best day?' },
    invalidProps: ['options', 'profileId', 'userId'],
  },
  {
    pattern: PollCommands.VOTE,
    dto: VotePollDto,
    valid: { pollId: 'poll-1', profileId: 'profile-1', optionIndexes: [0] },
    invalid: { pollId: 'poll-1', profileId: 'profile-1' },
    invalidProps: ['optionIndexes'],
  },
  {
    pattern: PostShareCommands.CREATE,
    dto: SharePostDto,
    valid: { postId: 'post-1', profileId: 'profile-1' },
    invalid: { postId: 'post-1' },
    invalidProps: ['profileId'],
  },
  {
    pattern: PresenceCommands.SET_PRESENCE,
    dto: SetPresenceDto,
    valid: { userId: 'user-1', status: PresenceStatus.ONLINE },
    invalid: { userId: 'user-1', status: 'invisible' },
    invalidProps: ['status'],
  },
  {
    pattern: PresenceCommands.GET_PRESENCE,
    dto: GetPresenceDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: SocialEventCommands.CREATE,
    dto: CreateSocialEventDto,
    valid: validEvent,
    invalid: { title: 'Meetup' },
    invalidProps: ['startDate'],
  },
  {
    pattern: SocialEventCommands.FIND,
    dto: SocialEventRefDto,
    valid: { eventId: 'event-1' },
    invalid: {},
    invalidProps: ['eventId'],
  },
  {
    pattern: BusinessContentCommands.PAGE_GET,
    dto: BusinessPageRefDto,
    valid: { communityId: 'community-1' },
    invalid: {},
    invalidProps: ['communityId'],
  },
  {
    pattern: BusinessContentCommands.PAGE_CREATE,
    dto: CreateBusinessPageContentDto,
    valid: { communityId: 'community-1', ownerId: 'user-1' },
    invalid: { communityId: 'community-1' },
    invalidProps: ['ownerId'],
  },
  {
    pattern: BusinessContentCommands.PAGE_UPDATE,
    dto: UpdateBusinessPageContentDto,
    valid: {
      communityId: 'community-1',
      ownerId: 'user-1',
      data: { name: 'New' },
    },
    invalid: { communityId: 'community-1', ownerId: 'user-1' },
    invalidProps: ['data'],
  },
  {
    pattern: BusinessContentCommands.PAGES_BY_COMMUNITIES,
    dto: CommunitiesPagesDto,
    valid: { communityIds: ['community-1'] },
    invalid: { communityIds: 'community-1' },
    invalidProps: ['communityIds'],
  },
  {
    pattern: BusinessContentCommands.THEME_GET,
    dto: BusinessThemeRefDto,
    valid: { businessPageId: 'page-1' },
    invalid: {},
    invalidProps: ['businessPageId'],
  },
  {
    pattern: BusinessContentCommands.THEME_CREATE,
    dto: CreateBusinessThemeDto,
    valid: { businessPageId: 'page-1', primaryColor: '#000' },
    invalid: { primaryColor: '#000' },
    invalidProps: ['businessPageId'],
  },
  {
    pattern: BusinessContentCommands.SPONSORSHIP_ACTIVE,
    dto: CommunitySponsorshipsDto,
    valid: { communityId: 'community-1' },
    invalid: {},
    invalidProps: ['communityId'],
  },
  {
    pattern: BusinessContentCommands.SPONSORSHIP_USER,
    dto: UserSponsorshipsDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: BusinessContentCommands.SPONSORSHIP_CREATE,
    dto: CreateSponsorshipContentDto,
    valid: { communityId: 'community-1', userId: 'user-1', type: 'banner' },
    invalid: { communityId: 'community-1', userId: 'user-1', type: 'popup' },
    invalidProps: ['type'],
  },
];

const DEFERRED_KEYS: Record<string, string[]> = {
  PostCommands: ['UPDATE', 'DELETE', 'FIND_MANY'],
  CommunityCommands: [
    'UPDATE',
    'DELETE',
    'FIND_BY_SLUG',
    'FIND_MANY',
    'LIST_LOCALITY',
    'GET_TOP_ACTIVE',
    'GET_MEMBERS',
    'FIND_MEMBER',
    'FIND_INVITE',
    'GET_USER_COMMUNITIES',
    'INVITE',
    'INVITE_BY_EMAIL',
    'ACCEPT_INVITE_BY_TOKEN',
    'FIND_INVITE_BY_TOKEN',
    'REMOVE_MEMBER',
    'APPROVE_MEMBER',
    'REJECT_MEMBER',
    'GET_PENDING_INVITES',
    'GET_PENDING_JOIN_REQUESTS',
    'CANCEL_INVITE',
    'GET_FEED',
    'GET_SUB_COMMUNITIES',
    'GET_MANAGER',
    'GET_ELECTION',
    'APPOINT_MANAGER',
    'REVOKE_MANAGER',
    'START_ELECTION',
    'NOMINATE',
    'VOTE',
    'CLOSE_ELECTION',
    'WITHDRAW_CANDIDATE',
  ],
  FollowCommands: [
    'GET_FOLLOWERS',
    'GET_FOLLOWING',
    'GET_MUTUALS',
    'GET_FOLLOWER_COUNT',
    'GET_FOLLOWING_COUNT',
  ],
  PollCommands: ['UPDATE', 'DELETE', 'FIND', 'FIND_MANY', 'REMOVE_VOTE'],
  PostShareCommands: ['DELETE', 'FIND_BY_POST', 'FIND_BY_PROFILE'],
  PresenceCommands: [
    'GET_PRESENCE_BATCH',
    'GET_ONLINE_USERS',
    'UPDATE_LAST_SEEN',
    'SET_OFFLINE',
  ],
  SocialEventCommands: [
    'UPDATE',
    'DELETE',
    'FIND_MANY',
    'FIND_UPCOMING',
    'ATTEND',
    'UNATTEND',
    'IS_ATTENDING',
  ],
  BusinessContentCommands: [],
};

const COMMAND_OBJECTS: Record<string, Record<string, string>> = {
  PostCommands: PostCommands as Record<string, string>,
  CommunityCommands: CommunityCommands as Record<string, string>,
  FollowCommands: FollowCommands as Record<string, string>,
  PollCommands: PollCommands as Record<string, string>,
  PostShareCommands: PostShareCommands as Record<string, string>,
  PresenceCommands: PresenceCommands as Record<string, string>,
  SocialEventCommands: SocialEventCommands as Record<string, string>,
  BusinessContentCommands: BusinessContentCommands as Record<string, string>,
};

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('social-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it('accounts for every key in the touched command objects', () => {
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    for (const [name, commands] of Object.entries(COMMAND_OBJECTS)) {
      const expected = new Set([
        ...COVERED.filter((c) =>
          Object.values(commands).includes(c.pattern)
        ).map((c) => c.pattern),
        ...DEFERRED_KEYS[name].map((k) => commands[k]),
      ]);
      expect(new Set(Object.values(commands))).toEqual(expected);
      for (const key of DEFERRED_KEYS[name]) {
        expect(coveredValues.has(commands[key])).toBe(false);
      }
    }
  });

  it('pins the SocialEvent enums to the entity values', () => {
    expect(Object.values(SocialEventStatus).sort()).toEqual(
      ['draft', 'published', 'cancelled', 'completed'].sort()
    );
    expect(Object.values(SocialEventPrivacy).sort()).toEqual(
      ['public', 'private', 'community'].sort()
    );
  });

  it('pins PresenceStatus to the entity values', () => {
    expect(Object.values(PresenceStatus).sort()).toEqual(
      ['online', 'offline', 'away', 'busy'].sort()
    );
  });

  it('SocialPostDto accepts the canonical read shape', async () => {
    const dto = plainToInstance(SocialPostDto, {
      ...validPost,
      appScope: 'social',
      visibility: 'public',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('SocialEventDto accepts the canonical read shape', async () => {
    const dto = plainToInstance(SocialEventDto, {
      ...validEvent,
      privacy: SocialEventPrivacy.PUBLIC,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('CommunityDto accepts the canonical read shape', async () => {
    const dto = plainToInstance(CommunityDto, {
      name: 'North Star',
      ownerId: 'profile-1',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('FollowGraphDto accepts a profile graph read', async () => {
    const dto = plainToInstance(FollowGraphDto, { profileId: 'profile-1' });
    expect(await validate(dto)).toEqual([]);
  });
});
