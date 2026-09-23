import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { LearningCommands } from '../index';
import {
  AnswerActivityDto,
  CodeLanguage,
  EvaluationGrader,
  EvaluationMode,
  RecordEvaluationDto,
  RunCodeDto,
  SubmitAttemptDto,
  SubmitExerciseDto,
} from './attempt';
import { EnrolDto, ProfileEnrolmentsDto, WithdrawDto } from './enrolment';
import {
  CO_EDITOR_PROFILE_ID_MAX,
  CreateOfferingDto,
  GetDashboardDto,
  GetLessonDto,
  GetOfferingDto,
  ListChallengesDto,
  ListMyOfferingsDto,
  OfferingRefDto,
  PublicationStatus,
  SetCoEditorsDto,
  SetOfferingStatusDto,
  UpdateOfferingDto,
} from './offering';
import { SaveLessonProgressDto } from './progress';

/**
 * Covered patterns with their contract DTO plus one valid and one invalid
 * sample. Catalog reads (`ListPrograms`, `ListCatalog`, `ListSubjects`),
 * `GetCreditLedger`, and `GetAttempt` (no live handler) are follow-up slices
 * (DEFERRED) — the catalog shapes align with learning-domain zod work, not
 * this slice.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: LearningCommands.Enrol,
    dto: EnrolDto,
    valid: { profileId: 'profile-1', offeringId: 'offering-1' },
    invalid: { profileId: 'profile-1' },
    invalidProps: ['offeringId'],
  },
  {
    pattern: LearningCommands.Withdraw,
    dto: WithdrawDto,
    valid: { profileId: 'profile-1', offeringId: 'offering-1' },
    invalid: { offeringId: 'offering-1' },
    invalidProps: ['profileId'],
  },
  {
    pattern: LearningCommands.ListMyEnrolments,
    dto: ProfileEnrolmentsDto,
    valid: { profileId: 'profile-1' },
    invalid: {},
    invalidProps: ['profileId'],
  },
  {
    pattern: LearningCommands.GetProgress,
    dto: ProfileEnrolmentsDto,
    valid: { profileId: 'profile-1' },
    invalid: {},
    invalidProps: ['profileId'],
  },
  {
    pattern: LearningCommands.SaveLessonProgress,
    dto: SaveLessonProgressDto,
    valid: {
      profileId: 'profile-1',
      userId: 'user-1',
      lessonId: 'lesson-1',
      completed: true,
    },
    invalid: {
      profileId: 'profile-1',
      userId: 'user-1',
      lessonId: 'lesson-1',
    },
    invalidProps: ['completed'],
  },
  {
    pattern: LearningCommands.SubmitAttempt,
    dto: SubmitAttemptDto,
    valid: {
      userId: 'user-1',
      offeringId: 'offering-1',
      activityId: 'activity-1',
      activityType: 'code',
      submission: { code: 'print(1)' },
    },
    invalid: {
      userId: 'user-1',
      offeringId: 'offering-1',
      activityId: 'activity-1',
    },
    invalidProps: ['activityType', 'submission'],
  },
  {
    pattern: LearningCommands.RecordEvaluation,
    dto: RecordEvaluationDto,
    valid: {
      attemptId: 'attempt-1',
      mode: EvaluationMode.ASYNC,
      grader: EvaluationGrader.LLM,
      score: 8,
      maxScore: 10,
      feedback: 'Good work',
    },
    invalid: {
      attemptId: 'attempt-1',
      mode: EvaluationMode.ASYNC,
      grader: EvaluationGrader.LLM,
      score: -1,
      maxScore: 10,
      feedback: 'Good work',
    },
    invalidProps: ['score'],
  },
  {
    pattern: LearningCommands.RunCode,
    dto: RunCodeDto,
    valid: { activityId: 'activity-1', code: 'print(1)' },
    invalid: { activityId: 'activity-1' },
    invalidProps: ['code'],
  },
  {
    pattern: LearningCommands.SubmitExercise,
    dto: SubmitExerciseDto,
    valid: {
      profileId: 'profile-1',
      userId: 'user-1',
      activityId: 'activity-1',
      code: 'print(1)',
    },
    invalid: {
      profileId: 'profile-1',
      userId: 'user-1',
      code: 'print(1)',
    },
    invalidProps: ['activityId'],
  },
  {
    pattern: LearningCommands.AnswerActivity,
    dto: AnswerActivityDto,
    valid: {
      profileId: 'profile-1',
      userId: 'user-1',
      activityId: 'activity-1',
      submission: { choice: 'a' },
    },
    invalid: {
      profileId: 'profile-1',
      userId: 'user-1',
      activityId: 'activity-1',
    },
    invalidProps: ['submission'],
  },
  {
    pattern: LearningCommands.GetLesson,
    dto: GetLessonDto,
    valid: { trackId: 'track-1', lessonId: 'lesson-1' },
    invalid: { lessonId: 'lesson-1' },
    invalidProps: ['trackId'],
  },
  {
    pattern: LearningCommands.GetOffering,
    dto: GetOfferingDto,
    valid: { offeringId: 'offering-1' },
    invalid: {},
    invalidProps: ['offeringId'],
  },
  {
    pattern: LearningCommands.ListMyOfferings,
    dto: ListMyOfferingsDto,
    valid: { profileId: 'profile-1' },
    invalid: {},
    invalidProps: ['profileId'],
  },
  {
    pattern: LearningCommands.GetDashboard,
    dto: GetDashboardDto,
    valid: {},
    invalid: { profileId: 42 },
    invalidProps: ['profileId'],
  },
  {
    pattern: LearningCommands.ListChallenges,
    dto: ListChallengesDto,
    valid: {},
    invalid: { trackId: 42 },
    invalidProps: ['trackId'],
  },
  {
    pattern: LearningCommands.CreateOffering,
    dto: CreateOfferingDto,
    valid: {
      profileId: 'profile-1',
      displayName: 'Intro to Go',
      subjectId: 'programming',
    },
    invalid: { profileId: 'profile-1', subjectId: 'programming' },
    invalidProps: ['displayName'],
  },
  {
    pattern: LearningCommands.UpdateOffering,
    dto: UpdateOfferingDto,
    valid: { offeringId: 'offering-1', displayName: 'Intro to Go v2' },
    invalid: { displayName: 'Intro to Go v2' },
    invalidProps: ['offeringId'],
  },
  {
    pattern: LearningCommands.DeleteOffering,
    dto: OfferingRefDto,
    valid: { offeringId: 'offering-1' },
    invalid: {},
    invalidProps: ['offeringId'],
  },
  {
    pattern: LearningCommands.GetOfferingOwnership,
    dto: OfferingRefDto,
    valid: { offeringId: 'offering-1' },
    invalid: {},
    invalidProps: ['offeringId'],
  },
  {
    pattern: LearningCommands.SetOfferingStatus,
    dto: SetOfferingStatusDto,
    valid: { offeringId: 'offering-1', status: PublicationStatus.PUBLISHED },
    invalid: { offeringId: 'offering-1', status: 'archived' },
    invalidProps: ['status'],
  },
  {
    pattern: LearningCommands.SetCoEditors,
    dto: SetCoEditorsDto,
    valid: {
      offeringId: 'offering-1',
      coEditorProfileIds: ['2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11'],
    },
    invalid: { offeringId: 'offering-1', coEditorProfileIds: ['x'] },
    invalidProps: ['coEditorProfileIds'],
  },
];

const DEFERRED = [
  'ListPrograms',
  'ListCatalog',
  'ListSubjects',
  'GetCreditLedger',
  'GetAttempt',
];

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('learning-contract-parity', () => {
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

  it('covers the learner/author flows and names the deferred reads', () => {
    const commands = LearningCommands as Record<string, string>;
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const expected = new Set([
      ...coveredValues,
      ...DEFERRED.map((k) => commands[k]),
    ]);
    expect(new Set(Object.values(commands))).toEqual(expected);
    for (const key of DEFERRED) {
      expect(coveredValues.has(commands[key])).toBe(false);
    }
  });

  it('pins mirrored learning-domain values', () => {
    expect(Object.values(CodeLanguage).sort()).toEqual(
      ['typescript', 'go', 'cpp', 'rust'].sort()
    );
    expect(Object.values(PublicationStatus).sort()).toEqual(
      ['draft', 'published'].sort()
    );
    expect(CO_EDITOR_PROFILE_ID_MAX).toBe(50);
  });
});
