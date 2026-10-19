export const ACCOUNT_EXPORT_CONTRACT_VERSION = 1 as const;
export const ACCOUNT_EXPORT_COVERAGE_VERSION = '2026-10-17.v1' as const;

export const ACCOUNT_EXPORT_PREVIEW_BUDGETS = {
  maxStringFieldCharacters: 4096,
  maxParticipantSerializedBytes: 512 * 1024,
  maxCombinedPreviewSerializedBytes: 1024 * 1024,
} as const;

/** Candidate owners found during the initial mapper pass, not an accepted inventory. */
export const ACCOUNT_EXPORT_COVERAGE_INVENTORY = {
  version: ACCOUNT_EXPORT_COVERAGE_VERSION,
  accepted: false,
  participants: [
    'authentication',
    'profile',
    'permissions',
    'social',
    'forum',
    'chat-collector',
    'classifieds',
    'assets',
    'videos',
    'workspace',
    'app-configurator',
    'compliance-audit',
    'billing',
    'blogging',
    'civic',
    'finance',
    'learning-service',
    'lead-tracker',
    'payments',
    'project-planning',
    'store',
    'system-configurator-api',
    'telos-docs-service',
    'wellness',
  ] as const,
} as const;

export type AccountExportKnownParticipant =
  (typeof ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants)[number];

export interface AccountExportParticipantSnapshot<TData = unknown> {
  contractVersion: typeof ACCOUNT_EXPORT_CONTRACT_VERSION;
  participantId: string;
  accountId: string;
  status: 'complete' | 'partial' | 'failed';
  uncovered: string[];
  data: TData;
}

export interface AccountExportCompleteness {
  complete: boolean;
  status: 'EXPORT_INCOMPLETE' | 'EXPORT_COMPLETE';
  coverageVersion: typeof ACCOUNT_EXPORT_COVERAGE_VERSION;
  blockers: string[];
}

/**
 * Evaluates coverage against the fixed workspace candidate inventory. Acceptance
 * is intentionally not an argument: this checkpoint cannot make the inventory
 * complete by passing a client-controlled flag.
 */
export function evaluateAccountExportCompleteness(
  snapshots: readonly AccountExportParticipantSnapshot[],
  expectedAccountId: string
): AccountExportCompleteness {
  const blockers = new Set<string>();
  const known = new Set<string>(ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants);
  const counts = new Map<string, number>();

  if (!ACCOUNT_EXPORT_COVERAGE_INVENTORY.accepted) {
    blockers.add('coverage-inventory-unaccepted');
  }

  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== 'object') {
      blockers.add('invalid-participant-snapshot');
      continue;
    }
    const participantId =
      typeof snapshot.participantId === 'string' &&
      snapshot.participantId.length > 0
        ? snapshot.participantId
        : 'unknown';
    counts.set(participantId, (counts.get(participantId) ?? 0) + 1);
    if (snapshot.contractVersion !== ACCOUNT_EXPORT_CONTRACT_VERSION) {
      blockers.add(`invalid-contract-version:${participantId}`);
    }
    if (snapshot.accountId !== expectedAccountId) {
      blockers.add(`account-id-mismatch:${participantId}`);
    }
    if (!known.has(participantId)) {
      blockers.add(`unknown-participant:${participantId}`);
      continue;
    }
    if (!Array.isArray(snapshot.uncovered)) {
      blockers.add(`invalid-participant-snapshot:${participantId}`);
    }
    const status = snapshot.status as string;
    if (!['complete', 'partial', 'failed'].includes(status)) {
      blockers.add(`invalid-participant-status:${participantId}`);
    } else if (status === 'failed') {
      blockers.add(`failed-participant:${participantId}`);
    } else if (
      status === 'partial' ||
      (Array.isArray(snapshot.uncovered) && snapshot.uncovered.length > 0)
    ) {
      blockers.add(`partial-participant:${participantId}`);
    }
  }

  for (const participantId of known) {
    const count = counts.get(participantId) ?? 0;
    if (count === 0) blockers.add(`missing-participant:${participantId}`);
    if (count > 1) blockers.add(`duplicate-participant:${participantId}`);
  }

  const complete = blockers.size === 0;
  return {
    complete,
    status: complete ? 'EXPORT_COMPLETE' : 'EXPORT_INCOMPLETE',
    coverageVersion: ACCOUNT_EXPORT_COVERAGE_VERSION,
    blockers: [...blockers].sort(),
  };
}

export interface AccountExportPreview {
  contractVersion: typeof ACCOUNT_EXPORT_CONTRACT_VERSION;
  accountId: string;
  complete: false;
  status: 'EXPORT_INCOMPLETE';
  downloadable: false;
  coverage: AccountExportCompleteness;
  participants: AccountExportParticipantSnapshot[];
  uncovered?: string[];
  previewLimits?: {
    maxSerializedBytes: number;
    dataOmittedForBudget: boolean;
  };
}

export const ACCOUNT_EXPORT_JOB_CONTRACT_VERSION = 1 as const;
export type AccountExportJobState =
  | 'queued'
  | 'incomplete'
  | 'running'
  | 'failed'
  | 'complete';
export interface AccountExportJobRequest {
  accountId: string;
  token: string;
  appId: string;
  idempotencyKey: string;
}
export interface AccountExportJobResumeRequest {
  accountId: string;
  token: string;
  appId: string;
  jobId: string;
}
export interface AccountExportJobStatus {
  contractVersion: typeof ACCOUNT_EXPORT_JOB_CONTRACT_VERSION;
  jobId: string;
  accountId: string;
  appId: string;
  kind: 'export';
  state: AccountExportJobState;
  attempt: number;
  coverageVersion: string;
  coverageSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  artifactUrl: null;
}

export type AccountExportJobErrorCode =
  | 'EXPORT_JOB_INVALID_REQUEST'
  | 'EXPORT_JOB_SESSION_INVALID'
  | 'EXPORT_JOB_NOT_FOUND'
  | 'EXPORT_JOB_BUSY';
export interface AccountExportJobError {
  contractVersion: typeof ACCOUNT_EXPORT_JOB_CONTRACT_VERSION;
  statusCode: 400 | 403 | 404 | 409;
  code: AccountExportJobErrorCode;
  message: string;
}
