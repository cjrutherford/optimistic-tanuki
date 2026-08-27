/**
 * Which model runs which onboarding task.
 *
 * The candidates are not interchangeable, and the differences were measured
 * rather than assumed (same resume, same five-turn interview):
 *
 *                       granite4:tiny-h    qwen3.5:4b-q8_0
 *   resume parse        91s                102-116s
 *   DISC question       3-4s               15-19s
 *   schema conformance  3/3 bare           needs prompt priming
 *   follow-up depth     profile-grounded   quotes the answer back
 *
 * Granite is faster everywhere and never needs coaxing, so it takes the
 * extraction work. Qwen is the only one whose interview questions build on what
 * the candidate just said — "when you took over the lead SRE's runbooks..." —
 * and that is the whole difference between an interview and a questionnaire, so
 * it keeps the conversational tasks despite being four times slower.
 *
 * Re-measure with `node tools/scripts/pilot-onboarding-models.mjs --structured`
 * before changing any of this.
 */
export type LlmTask =
  /** Pull structured fields out of a resume. Extraction, not conversation. */
  | 'resume-parse'
  /** Normalise the intro sentence into profile fields. */
  | 'mad-lib'
  /** Turn a finished profile into discovery topics. The longest call. */
  | 'topic-analysis'
  /** Ask the next interview question, given everything said so far. */
  | 'disc-question'
  /** Score the finished transcript across the four quadrants. */
  | 'disc-assessment';

/**
 * Tasks that read a conversation and must respond to its specifics. These are
 * the ones where model choice is felt by the user rather than just timed.
 */
const CONVERSATIONAL_TASKS: ReadonlySet<LlmTask> = new Set([
  'disc-question',
  'disc-assessment',
]);

export interface TaskModelConfig {
  /** Default for extraction work, and the fallback for anything unset. */
  primary: string;
  /** Used for the conversational tasks when configured. */
  conversational?: string;
  /** Per-task overrides, highest precedence. */
  overrides?: Partial<Record<LlmTask, string>>;
}

/**
 * Resolves the model for a task.
 *
 * Falls back to the primary whenever a more specific choice is unset, so a
 * single-model deployment keeps working with no configuration at all.
 */
export const resolveTaskModel = (
  task: LlmTask,
  config: TaskModelConfig
): string => {
  const override = config.overrides?.[task];
  if (override) {
    return override;
  }

  if (CONVERSATIONAL_TASKS.has(task) && config.conversational) {
    return config.conversational;
  }

  return config.primary;
};

/** Why a task resolved to the model it did, for the startup log. */
export const describeTaskModel = (
  task: LlmTask,
  config: TaskModelConfig
): string => {
  if (config.overrides?.[task]) {
    return `${config.overrides[task]} (override)`;
  }
  if (CONVERSATIONAL_TASKS.has(task) && config.conversational) {
    return `${config.conversational} (conversational)`;
  }
  return `${config.primary} (primary)`;
};

export const ALL_LLM_TASKS: readonly LlmTask[] = [
  'resume-parse',
  'mad-lib',
  'topic-analysis',
  'disc-question',
  'disc-assessment',
];
