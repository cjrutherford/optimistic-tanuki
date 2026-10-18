import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  GoalCommands,
  ProfileCommands,
  ProjectCommands,
  TimelineCommands,
} from '../index';
import {
  BlogRole,
  GuardianConsoleProfileRequestDto,
  GuardianProfileRequestDto,
  CreateProfileDto,
  CreateTimelineDto,
  GetProfileDto,
  SearchProfilesDto,
  SetBlogRoleDto,
  TimelineEventType,
  TimelineRefDto,
  UpdateProfileDto,
} from '../index';

/**
 * Covered patterns with their contract DTO plus one valid and one invalid
 * sample. `GetAll` patterns take `FindManyOptions` (complete by definition).
 * `GetBlogRole`/`Get` (timeline) take raw strings — listed in SCALAR.
 * `ProfileCommands.Delete` is sent by the gateway with no microservice
 * handler, `GetPhoto`/`GetCover` and timeline `Update`/`Delete` have neither
 * sender nor handler, and the `Goal*`/`Project*` command objects in
 * `profile.ts` are owned elsewhere (finance handles fin-commander goals) —
 * all named in UNHANDLED/UNOWNED so the gaps are explicit.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: ProfileCommands.Create,
    dto: CreateProfileDto,
    valid: {
      name: 'Ada Lovelace',
      description: 'Engineer',
      userId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalid: {
      description: 'Engineer',
      userId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalidProps: ['name'],
  },
  {
    pattern: ProfileCommands.Get,
    dto: GetProfileDto,
    valid: { userId: 'user-1', appScope: 'global' },
    invalid: { userId: 42 },
    invalidProps: ['userId'],
  },
  {
    pattern: ProfileCommands.Search,
    dto: SearchProfilesDto,
    valid: { query: 'ada', limit: 10 },
    invalid: { limit: -1 },
    invalidProps: ['limit'],
  },
  {
    pattern: ProfileCommands.Update,
    dto: UpdateProfileDto,
    valid: { id: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11', name: 'Augusta' },
    invalid: { id: 'not-a-uuid', name: '' },
    invalidProps: ['id', 'name'],
  },
  {
    pattern: ProfileCommands.SetBlogRole,
    dto: SetBlogRoleDto,
    valid: { profileId: 'profile-1', blogRole: BlogRole.OWNER },
    invalid: { profileId: 'profile-1', blogRole: 'admin' },
    invalidProps: ['blogRole'],
  },
  {
    pattern: ProfileCommands.GetGuardian,
    dto: GuardianProfileRequestDto,
    valid: {
      profileId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      actorUserId: '3d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a22',
      appId: 'client-interface',
      operation: 'profile.view',
    },
    invalid: {
      profileId: 'not-a-uuid',
      actorUserId: 'not-a-uuid',
      appId: 'other',
      operation: 'profile.read',
    },
    invalidProps: ['profileId', 'actorUserId', 'appId', 'operation'],
  },
  {
    pattern: ProfileCommands.UpdateGuardian,
    dto: GuardianProfileRequestDto,
    valid: {
      profileId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      actorUserId: '3d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a22',
      appId: 'local-hub',
      operation: 'profile.manage',
      updates: { bio: 'Updated bio' },
    },
    invalid: {
      profileId: 'not-a-uuid',
      actorUserId: 'not-a-uuid',
      appId: 'other',
      operation: 'profile.write',
      updates: [],
    },
    invalidProps: ['profileId', 'actorUserId', 'appId', 'operation', 'updates'],
  },
  {
    pattern: ProfileCommands.GetGuardianConsoleProfile,
    dto: GuardianConsoleProfileRequestDto,
    valid: { userId: 'user-1', appScope: 'local-hub' },
    invalid: { userId: 42, appScope: 'social' },
    invalidProps: ['userId', 'appScope'],
  },
  {
    pattern: TimelineCommands.Create,
    dto: CreateTimelineDto,
    valid: {
      name: 'Launch',
      description: 'Launch timeline',
      userId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      profileId: '3d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a22',
      projectId: '4d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a33',
      goalId: '5d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a44',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      isCompleted: false,
      isPublished: false,
      isDeleted: false,
      type: TimelineEventType.Posted,
    },
    invalid: { name: 'Launch' },
    invalidProps: [
      'description',
      'userId',
      'profileId',
      'projectId',
      'goalId',
      'startDate',
      'endDate',
      'isCompleted',
      'isPublished',
      'isDeleted',
      'type',
    ],
  },
  {
    pattern: TimelineCommands.Get,
    dto: TimelineRefDto,
    valid: { id: 'timeline-1' },
    invalid: {},
    invalidProps: ['id'],
  },
];

/** `FindManyOptions` reads — complete by definition. */
const FIND_MANY: string[] = [ProfileCommands.GetAll, TimelineCommands.GetAll];

/** Raw-string payloads — complete by definition. */
const SCALAR: string[] = [ProfileCommands.GetBlogRole, TimelineCommands.Get];
/** Internal object payload with strict validation at the handler boundary. */
const OBJECT: string[] = [
  ProfileCommands.GetAccountExportSnapshot,
  ProfileCommands.GetOwnedAccountProfileIdPage,
];

/**
 * Sent or defined with no live handler (Delete), or neither sender nor
 * handler (the rest). Closing any entry means adding the handler plus a DTO
 * above and moving the key into COVERED.
 */
const UNHANDLED: string[] = [
  ProfileCommands.Delete,
  ProfileCommands.GetPhoto,
  ProfileCommands.GetCover,
  TimelineCommands.Update,
  TimelineCommands.Delete,
];

/** Owned elsewhere or legacy — not profile-service surface. */
const UNOWNED: string[] = [
  ...Object.values(GoalCommands),
  ...Object.values(ProjectCommands),
];

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('profile-contract-parity', () => {
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

  it('accounts for every Profile/Timeline command key', () => {
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const allowed = new Set([...FIND_MANY, ...SCALAR, ...OBJECT, ...UNHANDLED]);
    for (const commands of [ProfileCommands, TimelineCommands]) {
      for (const value of Object.values(commands)) {
        expect(coveredValues.has(value) || allowed.has(value)).toBe(true);
      }
    }
    for (const pattern of UNHANDLED) {
      expect(coveredValues.has(pattern)).toBe(false);
    }
  });

  it('pins BlogRole to the entity values', () => {
    expect(Object.values(BlogRole).sort()).toEqual(
      ['none', 'poster', 'owner'].sort()
    );
  });
});
