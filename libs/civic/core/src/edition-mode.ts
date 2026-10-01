import type { BriefingCoverageMetadata, EditionMode } from './types.js';

/** The editorial state of one published daily edition. */
export type { EditionMode } from './types.js';

export interface PriorDailyEdition {
  periodStart: string;
  periodEnd: string;
  artifactVerified: boolean;
  metadata?: BriefingCoverageMetadata;
}

export interface EditionModeInput {
  /** Evidence in the requested daily interval, after editorial filtering. */
  dailyEvidence: boolean;
  /** Evidence anywhere in the ongoing-story context window. */
  contextEvidence?: boolean;
  currentPeriodStart: string;
  priorDaily?: PriorDailyEdition;
  /** Whether any verified prior daily edition exists, regardless of date. */
  verifiedPriorEdition?: boolean;
  /** A same-period row is an idempotency candidate, never a quiet predecessor. */
  samePeriodPrior?: boolean;
}

/** Select publication mode without treating a first run as a quiet day. */
export function resolveEditionMode(input: EditionModeInput): EditionMode {
  if (input.dailyEvidence)
    return input.verifiedPriorEdition === true || input.priorDaily
      ? 'normal'
      : 'bootstrap';
  const predecessorIsVerified =
    input.priorDaily?.artifactVerified === true &&
    input.priorDaily.periodEnd === input.currentPeriodStart &&
    input.priorDaily.periodStart < input.priorDaily.periodEnd;
  if (predecessorIsVerified) return 'quiet';
  // A first edition summarizes the context window even when the edition day itself is empty.
  if (input.contextEvidence && input.verifiedPriorEdition !== true)
    return 'bootstrap';
  return 'initial-empty';
}
