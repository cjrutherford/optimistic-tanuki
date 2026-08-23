import { z } from 'zod';

export const LEVEL_VALUES = [100, 200, 300, 400] as const;
export type CollegiateLevel = (typeof LEVEL_VALUES)[number];

export const ActivityTypeSchema = z.enum([
  'code.run',
  'quiz.mcq',
  'writing.response',
  'project.submission',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const LanguageSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
});
export type Language = z.infer<typeof LanguageSchema>;

export const RunnerProfileSchema = z.object({
  runtime: z.string().min(1),
  maxExecutionSeconds: z.number().int().positive().max(10),
  maxMemoryMiB: z.number().int().positive().max(256),
  maxProcesses: z.number().int().positive().max(32),
  maxOutputBytes: z.number().int().positive().max(1_048_576),
  networkEnabled: z.literal(false),
  readOnlyRootFilesystem: z.literal(true),
  writableFilesystem: z.literal('scratch-only'),
});
export type RunnerProfile = z.infer<typeof RunnerProfileSchema>;

export const TutorialSourceSchema = z.object({
  repositoryUrl: z
    .string()
    .url()
    .startsWith('https://github.com/cjrutherford/'),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  runner: RunnerProfileSchema,
});
export type TutorialSource = z.infer<typeof TutorialSourceSchema>;

export const SubjectSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  supportedLanguageIds: z.array(z.string().min(1)).min(1),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const FocusSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
});
export type Focus = z.infer<typeof FocusSchema>;

export const LessonVariantSchema = z.object({
  languageId: z.string().min(1),
  strategy: z.enum(['file-variant', 'fenced-blocks']),
  sourcePath: z.string().min(1),
});
export type LessonVariant = z.infer<typeof LessonVariantSchema>;

export const LessonMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  languageVariants: z.array(LessonVariantSchema).min(1),
  /**
   * The lesson this one breaks down, when it is a part rather than a whole.
   *
   * Go's basics split several topics into a short overview plus a few detail
   * lessons. Finishing every part finishes the overview, so a learner is not
   * asked to tick the same material twice.
   */
  parentLessonId: z.string().min(1).optional(),
});
export type LessonMetadata = z.infer<typeof LessonMetadataSchema>;

/**
 * Lesson ids that count as done, given what the learner actually completed.
 *
 * A parent lesson is included once all of its parts are done, whether or not
 * the learner opened the parent itself.
 */
export function rollUpCompletedLessons(
  lessons: readonly LessonMetadata[],
  completedLessonIds: Iterable<string>
): Set<string> {
  const completed = new Set(completedLessonIds);
  const partsByParent = new Map<string, string[]>();

  for (const lesson of lessons) {
    if (!lesson.parentLessonId) continue;
    const parts = partsByParent.get(lesson.parentLessonId) ?? [];
    parts.push(lesson.id);
    partsByParent.set(lesson.parentLessonId, parts);
  }

  for (const [parentId, parts] of partsByParent) {
    if (parts.every((part) => completed.has(part))) completed.add(parentId);
  }

  return completed;
}

export const ModuleMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  lessons: z.array(LessonMetadataSchema).min(1),
});
export type ModuleMetadata = z.infer<typeof ModuleMetadataSchema>;

export const CodeRunActivitySchema = z.object({
  type: z.literal('code.run'),
  id: z.string().min(1),
  prompt: z.string().min(1),
  starterCode: z.string(),
  expectedOutput: z.string().optional(),
});
export const QuizMcqActivitySchema = z.object({
  type: z.literal('quiz.mcq'),
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
    .min(2),
  correctOptionIds: z.array(z.string().min(1)).min(1),
});
export const WritingResponseActivitySchema = z.object({
  type: z.literal('writing.response'),
  id: z.string().min(1),
  prompt: z.string().min(1),
  maxWords: z.number().int().positive().optional(),
});
export const ProjectSubmissionActivitySchema = z.object({
  type: z.literal('project.submission'),
  id: z.string().min(1),
  prompt: z.string().min(1),
  artifactTypes: z.array(z.string().min(1)).min(1),
});

export const ActivitySchema = z.discriminatedUnion('type', [
  CodeRunActivitySchema,
  QuizMcqActivitySchema,
  WritingResponseActivitySchema,
  ProjectSubmissionActivitySchema,
]);
export type Activity = z.infer<typeof ActivitySchema>;

/** Workspace-owned exercise data, normalized from the former letsgo clients. */
export const CodeExerciseSchema = z.object({
  id: z.string().min(1),
  languageId: z.enum(['typescript', 'go', 'cpp', 'rust']),
  lessonSlug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  starterCode: z.string(),
  hints: z.array(z.string()),
  points: z.number().nonnegative(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  expectedOutput: z.string().optional(),
  /** Never returned by the public catalog endpoint. */
  verifier: z.object({
    testCode: z.string().optional(),
    validationPattern: z.string().optional(),
  }),
});
export type CodeExercise = z.infer<typeof CodeExerciseSchema>;

export const LessonProgressSchema = z.object({
  lessonId: z.string().min(1),
  completed: z.boolean(),
  completedExerciseIds: z.array(z.string()),
  points: z.number().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const CodeRunResultSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  errors: z.array(z.string()),
  timedOut: z.boolean().default(false),
  testsPassed: z.boolean().optional(),
});
export type CodeRunResult = z.infer<typeof CodeRunResultSchema>;

export const RequirementNodeSchema = z.object({
  kind: z.literal('offering'),
  offeringId: z.string().min(1),
});
export type RequirementNode = z.infer<typeof RequirementNodeSchema>;

export type RequirementChild = RequirementNode | RequirementGroup;

export interface RequirementGroup {
  id: string;
  operator: 'AND' | 'OR';
  minRequired?: number;
  children: RequirementChild[];
}

export const RequirementGroupSchema: z.ZodType<RequirementGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    operator: z.enum(['AND', 'OR']),
    minRequired: z.number().int().positive().optional(),
    children: z
      .array(z.union([RequirementNodeSchema, RequirementGroupSchema]))
      .min(1),
  })
);

export interface UnlockRule {
  id: string;
  requirement: RequirementGroup;
}

export const UnlockRuleSchema: z.ZodType<UnlockRule> = z.object({
  id: z.string().min(1),
  requirement: RequirementGroupSchema,
});

export const OfferingSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['course', 'project', 'milestone']),
  displayName: z.string().min(1),
  /**
   * Free-text summary an author can revise. Optional because every offering
   * that predates authored courses (the four built-in tracks) has none, and
   * backfilling one would be inventing copy nobody wrote.
   */
  description: z.string().optional(),
  subjectId: z.string().min(1),
  level: z.union([
    z.literal(100),
    z.literal(200),
    z.literal(300),
    z.literal(400),
  ]),
  credits: z.number().positive(),
  outcomeTags: z.array(z.string().min(1)).min(1),
  modules: z.array(ModuleMetadataSchema).min(1),
  activities: z.array(ActivitySchema).min(1),
  prerequisiteOfferingIds: z.array(z.string().min(1)).optional(),
  unlockRules: z.array(UnlockRuleSchema).optional(),
});
export type Offering = z.infer<typeof OfferingSchema>;

export const ProgramTrackSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
  supportedLanguageIds: z.array(z.string().min(1)).min(1),
  source: TutorialSourceSchema.optional(),
  focuses: z.array(FocusSchema).min(1),
  offerings: z.array(OfferingSchema).min(1),
  requirements: RequirementGroupSchema,
});
export type ProgramTrack = z.infer<typeof ProgramTrackSchema>;

export const AttemptSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  offeringId: z.string().min(1),
  activityId: z.string().min(1),
  activityType: ActivityTypeSchema,
  state: z.enum(['draft', 'submitted', 'graded', 'needs_revision']),
  isAsync: z.boolean(),
  submission: z.unknown(),
  submittedAt: z.string().datetime(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const RubricCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  maxPoints: z.number().nonnegative(),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const RubricSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  criteria: z.array(RubricCriterionSchema).min(1),
});
export type Rubric = z.infer<typeof RubricSchema>;

export const EvaluationSchema = z.object({
  id: z.string().min(1),
  attemptId: z.string().min(1),
  mode: z.enum(['sync', 'async']),
  grader: z.enum(['auto', 'llm', 'human']),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  feedback: z.string().min(1),
  rubric: RubricSchema.optional(),
  humanOverride: z.boolean().default(false),
  /**
   * Who wrote the score, taken from the verified token at the gateway.
   *
   * Optional because rows predate the field, not because it is dispensable.
   * A learner must never be able to grade themselves, so knowing who did is
   * the record that makes that checkable after the fact.
   */
  recordedByUserId: z.string().min(1).optional(),
  evaluatedAt: z.string().datetime(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/**
 * A learner's claim on an offering.
 *
 * Progress cannot be recorded without one of these existing first: it is the
 * thing that makes "taking this course" a real fact rather than an inference
 * from whatever rows happen to exist in lesson_progress.
 */
export const EnrolmentStatusSchema = z.enum(['active', 'withdrawn']);
export type EnrolmentStatus = z.infer<typeof EnrolmentStatusSchema>;

export const EnrolmentSchema = z.object({
  id: z.string().min(1),
  /** The learner's learning-scoped profile id, not their bare userId. */
  profileId: z.string().min(1),
  offeringId: z.string().min(1),
  status: EnrolmentStatusSchema,
  enrolledAt: z.string().datetime(),
  withdrawnAt: z.string().datetime().optional(),
});
export type Enrolment = z.infer<typeof EnrolmentSchema>;

/**
 * Refusing an action because the learner has not enrolled.
 *
 * Enrolment is deliberately explicit: taking a course is a decision, not a
 * side effect of pressing a button. The client needs to tell this apart from
 * a genuine failure so it can offer to enrol instead of showing an error.
 */
export const NOT_ENROLLED = 'NOT_ENROLLED';

export interface NotEnrolledPayload {
  code: typeof NOT_ENROLLED;
  offeringId: string;
  lessonId?: string;
}

export function isNotEnrolled(value: unknown): value is NotEnrolledPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { code?: unknown }).code === NOT_ENROLLED
  );
}

export const CreditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  offeringId: z.string().min(1),
  creditsAwarded: z.number().positive(),
  evaluationId: z.string().min(1),
  awardedAt: z.string().datetime(),
});
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>;

export interface RequirementEvaluation {
  satisfied: boolean;
  satisfiedChildren: number;
  requiredChildren: number;
}

function isRequirementNode(
  value: RequirementNode | RequirementGroup
): value is RequirementNode {
  return (value as RequirementNode).kind === 'offering';
}

export function evaluateRequirementGroup(
  group: RequirementGroup,
  completedOfferingIds: Iterable<string>
): RequirementEvaluation {
  const completedSet = new Set(completedOfferingIds);
  const satisfiedChildren = group.children.filter((child) => {
    if (isRequirementNode(child)) {
      return completedSet.has(child.offeringId);
    }
    return evaluateRequirementGroup(child, completedSet).satisfied;
  }).length;

  const requiredChildren =
    group.minRequired ?? (group.operator === 'AND' ? group.children.length : 1);

  return {
    satisfied: satisfiedChildren >= requiredChildren,
    satisfiedChildren,
    requiredChildren,
  };
}

export function calculateTotalCredits(
  offerings: readonly Offering[],
  completedOfferingIds: Iterable<string>
): number {
  const completedSet = new Set(completedOfferingIds);
  return offerings.reduce(
    (total, offering) =>
      completedSet.has(offering.id) ? total + offering.credits : total,
    0
  );
}

export function isOfferingUnlocked(
  offering: Offering,
  completedOfferingIds: Iterable<string>
): boolean {
  const completedSet = new Set(completedOfferingIds);
  const prerequisites = offering.prerequisiteOfferingIds ?? [];
  const hasPrerequisites = prerequisites.every((id) => completedSet.has(id));
  if (!hasPrerequisites) return false;

  const unlockRules = offering.unlockRules ?? [];
  return unlockRules.every(
    (rule) => evaluateRequirementGroup(rule.requirement, completedSet).satisfied
  );
}

/**
 * Ownership of an authored offering.
 *
 * An offering is not a database row, it is a value nested inside a
 * ProgramTrack's JSONB `data` column, so "who owns it" cannot live as a
 * foreign key on an offering table that does not exist. This is the side
 * table that answers that question instead, keyed on the offering's own id.
 */
export const OfferingOwnershipSchema = z.object({
  offeringId: z.string().min(1),
  ownerProfileId: z.string().min(1),
  coEditorProfileIds: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OfferingOwnership = z.infer<typeof OfferingOwnershipSchema>;

export const OFFERING_AUTHORIZATION_ACTIONS = [
  'create',
  'update',
  'delete',
  'manageCoEditors',
] as const;
export type OfferingAuthorizationAction =
  (typeof OFFERING_AUTHORIZATION_ACTIONS)[number];

export interface OfferingAuthorizationRoles {
  /** Holds `owner` or `global_admin` in the platform's global app scope. */
  isPlatformOwner: boolean;
  /** Holds `learning_admin` in the learning app scope. */
  isLearningAdmin: boolean;
  /** Holds `learning_course_designer` in the learning app scope. */
  isCourseDesigner: boolean;
}

/**
 * The single place that decides whether a profile may act on an offering.
 *
 * Deliberately a pure function of its inputs so it can be unit tested without
 * standing up a database or a permissions service: the gateway is
 * responsible for gathering the roles and the ownership record, this just
 * applies the rule.
 *
 * Precedence, in order:
 *  1. Platform owners and learning_admin may do anything.
 *  2. Creating a new offering only needs the course-designer role; there is
 *     no ownership record yet to check.
 *  3. Everything else needs an ownership record. The owning profile may
 *     update, delete, or manage co-editors. A co-editor may update content
 *     but never delete the offering or touch who owns or co-edits it.
 *  4. Anyone else, including a course designer who owns nothing here, is
 *     refused.
 */
export function authorizeOfferingAction(
  profileId: string,
  action: OfferingAuthorizationAction,
  roles: OfferingAuthorizationRoles,
  ownership: OfferingOwnership | undefined
): boolean {
  if (roles.isPlatformOwner || roles.isLearningAdmin) return true;

  if (action === 'create') return roles.isCourseDesigner;

  if (!ownership) return false;

  if (ownership.ownerProfileId === profileId) return true;

  if (action === 'update' && ownership.coEditorProfileIds.includes(profileId)) {
    return true;
  }

  return false;
}

/**
 * Fields an author supplies when opening a new offering.
 *
 * Deliberately thin: authoring the real content (modules, lessons,
 * activities) is a later slice. This only needs to produce something that
 * satisfies OfferingSchema, which requires at least one module and one
 * activity.
 */
export interface DraftOfferingInput {
  displayName: string;
  subjectId: string;
  description?: string;
  type?: Offering['type'];
  level?: CollegiateLevel;
  credits?: number;
  outcomeTags?: string[];
}

/**
 * The smallest offering that is honestly valid against OfferingSchema.
 *
 * OfferingSchema requires at least one module (with a lesson) and one
 * activity; there is no way to represent "an offering with no content yet"
 * without either weakening that schema (which would let every other offering
 * ship without a lesson too) or giving a draft real, if placeholder, content.
 * This takes the second path: one module, one lesson, one writing-response
 * activity, each labelled as a draft placeholder so nobody mistakes it for
 * finished material. The languageId 'any' is used rather than a programming
 * language because this platform is not about programming.
 */
export function buildDraftOffering(
  offeringId: string,
  input: DraftOfferingInput
): Offering {
  const offering: Offering = {
    id: offeringId,
    type: input.type ?? 'course',
    displayName: input.displayName,
    ...(input.description ? { description: input.description } : {}),
    subjectId: input.subjectId,
    level: input.level ?? 100,
    credits: input.credits ?? 1,
    outcomeTags:
      input.outcomeTags && input.outcomeTags.length > 0
        ? input.outcomeTags
        : ['draft'],
    modules: [
      {
        id: `${offeringId}-module-draft`,
        title: 'Getting started',
        lessons: [
          {
            id: `${offeringId}-lesson-draft`,
            title: 'Course overview',
            slug: 'overview',
            languageVariants: [
              {
                languageId: 'any',
                strategy: 'fenced-blocks',
                sourcePath: `drafts/${offeringId}/overview.md`,
              },
            ],
          },
        ],
      },
    ],
    activities: [
      {
        type: 'writing.response',
        id: `${offeringId}-activity-draft`,
        prompt:
          'Draft placeholder: describe what this course will cover. Replace before publishing.',
      },
    ],
  };
  return OfferingSchema.parse(offering);
}

/** Wraps a draft offering in the ProgramTrack it is stored inside. */
export function buildDraftProgramTrack(
  offeringId: string,
  input: DraftOfferingInput
): ProgramTrack {
  const offering = buildDraftOffering(offeringId, input);
  const track: ProgramTrack = {
    id: offeringId,
    displayName: input.displayName,
    subjectIds: [input.subjectId],
    supportedLanguageIds: ['any'],
    focuses: [
      {
        id: `${offeringId}-focus`,
        displayName: input.displayName,
        subjectIds: [input.subjectId],
      },
    ],
    offerings: [offering],
    requirements: {
      id: `${offeringId}-requirements`,
      operator: 'AND',
      children: [{ kind: 'offering', offeringId }],
    },
  };
  return ProgramTrackSchema.parse(track);
}
