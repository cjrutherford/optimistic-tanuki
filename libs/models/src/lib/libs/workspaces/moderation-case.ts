export const MODERATION_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'misinformation',
  'inappropriate',
  'other',
] as const;

export type ModerationReason = (typeof MODERATION_REASONS)[number];

export const MODERATION_OUTCOMES = [
  'approve',
  'reject',
  'dismiss',
  'restrict',
  'remove',
  'escalate',
] as const;

export type ModerationOutcome = (typeof MODERATION_OUTCOMES)[number];
export type ModerationCaseStatus = 'open' | 'resolved' | 'appealed';
export type ModerationEvidence = {
  kind: 'url' | 'text' | 'asset';
  value: string;
};

export interface ModerationSubjectReference {
  domain: string;
  resourceType: string;
  resourceId: string;
  workspaceId: string | null;
}

export interface ModerationDecision {
  outcome: ModerationOutcome;
  actorId: string;
  rationale?: string;
  occurredAt: string;
}

export interface ModerationAppeal {
  appellantId: string;
  reason: string;
  occurredAt: string;
}

export interface ModerationRetention {
  deleteAfter: string;
}

export interface ModerationCase {
  id: string;
  workspaceId: string | null;
  appScope: string;
  subject: ModerationSubjectReference;
  reporterId: string;
  reason: ModerationReason;
  evidence: ModerationEvidence[];
  retention: ModerationRetention;
  occurredAt: string;
  status: ModerationCaseStatus;
  decision: ModerationDecision | null;
  appeal: ModerationAppeal | null;
}

export type CreateModerationCaseInput = Omit<
  ModerationCase,
  'status' | 'decision' | 'appeal'
>;

export function createModerationCase(
  input: CreateModerationCaseInput
): ModerationCase {
  if (input.workspaceId !== input.subject.workspaceId) {
    throw new Error('Moderation case and subject must use the same workspace');
  }

  return { ...input, status: 'open', decision: null, appeal: null };
}

export function decideModerationCase(
  moderationCase: ModerationCase,
  decision: ModerationDecision
): ModerationCase {
  if (moderationCase.status !== 'open') {
    throw new Error('Moderation case is already resolved');
  }

  return { ...moderationCase, status: 'resolved', decision };
}

export function fileModerationAppeal(
  moderationCase: ModerationCase,
  appeal: ModerationAppeal
): ModerationCase {
  if (moderationCase.status === 'open') {
    throw new Error('Moderation case must be resolved before appeal');
  }
  if (moderationCase.appeal) {
    throw new Error('Moderation case is already appealed');
  }

  return { ...moderationCase, status: 'appealed', appeal };
}
