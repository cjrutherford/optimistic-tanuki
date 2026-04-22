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
});
export type LessonMetadata = z.infer<typeof LessonMetadataSchema>;

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
  options: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(
    2
  ),
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
    children: z.array(z.union([RequirementNodeSchema, RequirementGroupSchema])).min(1),
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
  evaluatedAt: z.string().datetime(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

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
