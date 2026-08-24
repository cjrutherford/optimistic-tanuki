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
  /**
   * Only meaningful for subjects that are about writing code. A subject like
   * watercolour painting has no languages, and requiring one here was the
   * first place this platform assumed it was teaching programming.
   */
  supportedLanguageIds: z.array(z.string().min(1)).min(1).optional(),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const FocusSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
});
export type Focus = z.infer<typeof FocusSchema>;

/**
 * An axis a track's lessons vary along.
 *
 * The four ported tutorial tracks vary by programming language, so their axis
 * is `language` with four options. A watercolour course varies along nothing
 * and declares no axis at all. Naming the axis rather than hard-coding
 * "language" is what lets a course vary by instrument, by dialect, by
 * apparatus, or by nothing.
 */
export const VariantOptionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
});
export type VariantOption = z.infer<typeof VariantOptionSchema>;

export const VariantAxisSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  options: z.array(VariantOptionSchema).min(1),
});
export type VariantAxis = z.infer<typeof VariantAxisSchema>;

/**
 * One rendition of a lesson's material.
 *
 * `variantId` names which option along the track's axis this rendition is for,
 * and is absent when the lesson does not vary. `format` says how to read what
 * is at `sourcePath`: a whole file, or a file whose fenced code blocks are
 * filtered down to the matching variant.
 */
export const LessonContentSchema = z
  .object({
    variantId: z.string().min(1).optional(),
    format: z.enum(['markdown', 'file-variant', 'fenced-blocks']),
    /**
     * A file that ships with the workspace. How the four ported tracks carry
     * their material, and the only option before courses could be authored.
     */
    sourcePath: z.string().min(1).optional(),
    /**
     * The lesson text itself, for a course written inside the product. An
     * author has no way to add a file to the repository, so their words have
     * to live with the course.
     */
    body: z.string().min(1).optional(),
  })
  .refine(
    (content) => Boolean(content.sourcePath) !== Boolean(content.body),
    // Not "at least one": a rendition with both would have two sources of
    // truth and no rule for which one a reader sees.
    { message: 'A lesson rendition needs either a sourcePath or a body' }
  );
export type LessonContent = z.infer<typeof LessonContentSchema>;

/**
 * Whether a course is visible to anyone other than the people writing it.
 *
 * Drafts are the default, so a course that has just been opened, or one stored
 * before this existed, stays private until somebody decides to publish it.
 */
export const PublicationStatusSchema = z.enum(['draft', 'published']);
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

interface LegacyLessonVariant {
  languageId?: unknown;
  strategy?: unknown;
  sourcePath?: unknown;
}

/**
 * Reads a lesson that still names its renditions `languageVariants`.
 *
 * Program tracks are stored as JSONB, so rows written before this slice carry
 * the old shape and cannot be rewritten by a schema change alone. Rather than
 * migrate a JSON blob whose contents nobody has audited, the old shape is read
 * and mapped forward: a languageId becomes a variantId, a strategy becomes a
 * format. Nothing writes the old shape any more.
 */
function readLegacyLessonContent(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const lesson = value as Record<string, unknown>;
  if ('content' in lesson || !Array.isArray(lesson['languageVariants'])) {
    return value;
  }
  const { languageVariants, ...rest } = lesson;
  return {
    ...rest,
    content: (languageVariants as LegacyLessonVariant[]).map((variant) => ({
      ...(typeof variant?.languageId === 'string'
        ? { variantId: variant.languageId }
        : {}),
      format: variant?.strategy ?? 'markdown',
      sourcePath: variant?.sourcePath,
    })),
  };
}

export const LessonMetadataSchema = z.preprocess(
  readLegacyLessonContent,
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().min(1),
    content: z.array(LessonContentSchema).min(1),
    /**
     * The lesson this one breaks down, when it is a part rather than a whole.
     *
     * Go's basics split several topics into a short overview plus a few detail
     * lessons. Finishing every part finishes the overview, so a learner is not
     * asked to tick the same material twice.
     */
    parentLessonId: z.string().min(1).optional(),
  })
);
export type LessonMetadata = z.infer<typeof LessonMetadataSchema>;

/**
 * The rendition to show, given what the reader asked for.
 *
 * Falls back deliberately rather than failing: the requested variant, then a
 * rendition that belongs to no variant, then whatever is first. A lesson
 * always has at least one rendition, so this always returns something.
 */
export function selectLessonContent(
  lesson: LessonMetadata,
  preferredVariantId?: string
): LessonContent {
  const requested = preferredVariantId
    ? lesson.content.find((item) => item.variantId === preferredVariantId)
    : undefined;
  const unvaried = lesson.content.find((item) => item.variantId === undefined);
  return requested ?? unvaried ?? lesson.content[0];
}

/** Whether a lesson carries a rendition for this variant specifically. */
export function lessonHasVariant(
  lesson: LessonMetadata,
  variantId: string
): boolean {
  return lesson.content.some((item) => item.variantId === variantId);
}

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
  /**
   * Defaults to draft, so an offering stored before publication existed is
   * treated as unfinished rather than silently shown to every learner.
   */
  status: PublicationStatusSchema.default('draft'),
  /**
   * Both may be empty, because a course that has just been opened has no
   * content yet. Requiring content here is what forced draft offerings to
   * carry a placeholder module and a placeholder activity that no author
   * wrote. An empty course is honest; a fake lesson is not.
   */
  modules: z.array(ModuleMetadataSchema),
  activities: z.array(ActivitySchema),
  prerequisiteOfferingIds: z.array(z.string().min(1)).optional(),
  unlockRules: z.array(UnlockRuleSchema).optional(),
});
export type Offering = z.infer<typeof OfferingSchema>;

export const ProgramTrackSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
  /**
   * Only for tracks that teach a programming language. Kept because the code
   * runner and the exercise catalog genuinely key on a language, and dropping
   * it would mean inventing a language somewhere else.
   */
  supportedLanguageIds: z.array(z.string().min(1)).min(1).optional(),
  /** The axis this track's lessons vary along, when they vary at all. */
  variantAxis: VariantAxisSchema.optional(),
  /**
   * Where this track's lesson files live, relative to the content root. Absent
   * for tracks with no files on disk. This used to be derived from the track's
   * language through a hard-coded map of four repository names, which meant a
   * track could only have content if it taught one of four languages.
   */
  contentCollection: z.string().min(1).optional(),
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

/**
 * A lesson that this reader cannot have, whether because it does not exist or
 * because it belongs to a course they are not entitled to read.
 *
 * A structured payload rather than a message, for the same reason NOT_ENROLLED
 * is one: an Error thrown in a microservice handler does not arrive at the
 * gateway with its message intact, so matching on text there looked right in a
 * unit test and answered 500 against the running service.
 */
export const LESSON_NOT_FOUND = 'LESSON_NOT_FOUND';

export interface LessonNotFoundPayload {
  code: typeof LESSON_NOT_FOUND;
  trackId?: string;
  lessonId?: string;
}

export function isLessonNotFound(
  value: unknown
): value is LessonNotFoundPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { code?: unknown }).code === LESSON_NOT_FOUND
  );
}

/** A course this reader cannot have, for the same reasons as a lesson. */
export const OFFERING_NOT_FOUND = 'OFFERING_NOT_FOUND';

export interface OfferingNotFoundPayload {
  code: typeof OFFERING_NOT_FOUND;
  offeringId: string;
}

export function isOfferingNotFound(
  value: unknown
): value is OfferingNotFoundPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { code?: unknown }).code === OFFERING_NOT_FOUND
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

/** Who is asking to see the catalog. */
export interface CatalogViewer {
  /** The caller's learning profile, absent for an anonymous visitor. */
  profileId?: string;
  /** Platform owners and learning_admin see drafts they do not own. */
  seesEveryDraft?: boolean;
}

/**
 * Whether this viewer may see this offering at all.
 *
 * A published course is public. A draft is visible only to the people writing
 * it and to the people who answer for the platform, so an author can work in
 * the open without shipping half a course to every learner.
 */
export function isOfferingVisibleTo(
  offering: Offering,
  ownership: OfferingOwnership | undefined,
  viewer: CatalogViewer
): boolean {
  if (offering.status === 'published') return true;
  if (viewer.seesEveryDraft) return true;
  if (!viewer.profileId || !ownership) return false;
  return (
    ownership.ownerProfileId === viewer.profileId ||
    ownership.coEditorProfileIds.includes(viewer.profileId)
  );
}

/**
 * The catalog as this viewer should see it.
 *
 * Tracks whose offerings are all invisible drop out entirely, rather than
 * appearing as an empty course with a name and nothing behind it.
 */
export function visibleTracks(
  tracks: readonly ProgramTrack[],
  ownershipByOfferingId: ReadonlyMap<string, OfferingOwnership>,
  viewer: CatalogViewer
): ProgramTrack[] {
  return tracks
    .map((track) => ({
      ...track,
      offerings: track.offerings.filter((offering) =>
        isOfferingVisibleTo(
          offering,
          ownershipByOfferingId.get(offering.id),
          viewer
        )
      ),
    }))
    .filter((track) => track.offerings.length > 0);
}

/**
 * Display names for the subjects the workspace ships with.
 *
 * Deliberately short. An authored course names whatever subject it is about,
 * and nobody will have registered it here, so this is a courtesy for the ids
 * we already know rather than a list of what a subject may be.
 */
const KNOWN_SUBJECT_NAMES: Record<string, string> = {
  programming: 'Programming',
  systems: 'Systems',
};

/**
 * A readable name for a subject id.
 *
 * Falls back to title-casing the id, so a course about `marine-biology` reads
 * as "Marine Biology" without anyone registering it first. A universal
 * platform cannot know its subjects in advance.
 */
export function subjectDisplayName(subjectId: string): string {
  const known = KNOWN_SUBJECT_NAMES[subjectId];
  if (known) return known;
  return subjectId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export interface SubjectGroup {
  subjectId: string;
  displayName: string;
  /** Focus names across this subject's tracks, deduplicated and in order. */
  focusNames: string[];
  tracks: ProgramTrack[];
}

/**
 * The catalog grouped the way a visitor browses it: by subject first.
 *
 * A track that spans several subjects appears under each of them, because a
 * course on computational biology belongs in both places and picking one for
 * the visitor would hide it from the other.
 */
export function groupTracksBySubject(
  tracks: readonly ProgramTrack[]
): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();
  for (const track of tracks) {
    for (const subjectId of track.subjectIds) {
      const group = groups.get(subjectId) ?? {
        subjectId,
        displayName: subjectDisplayName(subjectId),
        focusNames: [],
        tracks: [],
      };
      group.tracks.push(track);
      for (const focus of track.focuses) {
        if (
          focus.subjectIds.includes(subjectId) &&
          !group.focusNames.includes(focus.displayName)
        ) {
          group.focusNames.push(focus.displayName);
        }
      }
      groups.set(subjectId, group);
    }
  }
  return [...groups.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
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
  // Separate from update on purpose. A co-editor may revise a course; putting
  // it in front of learners is the owner's decision, not theirs.
  'publish',
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
 *     update, delete, manage co-editors, or publish. A co-editor may update
 *     content but never delete the offering, change who owns or co-edits it,
 *     or publish it.
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
 * activities) is a later slice.
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
 * A newly opened offering, with no content in it.
 *
 * An earlier version of this filled the draft with a placeholder module, a
 * placeholder lesson and a placeholder writing prompt, because OfferingSchema
 * demanded at least one of each. Those placeholders were content nobody wrote,
 * sitting in a catalog readers can see. The schema now allows an empty course,
 * so a draft is empty.
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
    // A new course is nobody's business but its author's until they say so.
    status: 'draft',
    modules: [],
    activities: [],
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
