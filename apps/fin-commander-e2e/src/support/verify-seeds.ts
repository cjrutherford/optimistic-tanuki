import type { SeedEvidenceCounts } from './db';

const DB_MARKERS = [
  'All databases created',
  'Database setup and migrations complete.',
] as const;

const PERMISSIONS_MARKER = 'Seeding completed successfully.';
const FINANCE_MARKER = 'Finance seeding completed successfully!';
const GATEWAY_READY_MARKER = 'Gateway is ready.';

export interface GatewayReadyEvidence {
  apiDocsOk: boolean;
  emptyLoginStatus: number;
}

export interface VerifySeedsInput {
  bootstrapLog: string;
  gatewayReady?: GatewayReadyEvidence;
  financeEvidence?: SeedEvidenceCounts;
  permissionsEvidence?: SeedEvidenceCounts;
}

export interface VerifySeedsSummary {
  dbSetupVerified: boolean;
  gatewayReadyVerified: boolean;
  permissionsSeedVerified: boolean;
  financeSeedVerified: boolean;
  financeEvidenceVerified: boolean;
  permissionsEvidenceVerified: boolean;
}

export interface VerifySeedsResult {
  ok: true;
  summary: VerifySeedsSummary;
}

function assertLogMarker(
  log: string,
  marker: string,
  description: string
): void {
  if (!log.includes(marker)) {
    throw new Error(`Missing ${description}: ${marker}`);
  }
}

function verifyFinanceEvidence(evidence?: SeedEvidenceCounts): boolean {
  if (!evidence) {
    return false;
  }

  return (evidence.accounts ?? 0) > 0 && (evidence.transactions ?? 0) > 0;
}

function verifyPermissionsEvidence(evidence?: SeedEvidenceCounts): boolean {
  if (!evidence) {
    return false;
  }

  return (evidence.permissions ?? 0) > 0 && (evidence.appScopes ?? 0) > 0;
}

export async function verifySeeds(
  input: VerifySeedsInput
): Promise<VerifySeedsResult> {
  for (const marker of DB_MARKERS) {
    assertLogMarker(input.bootstrapLog, marker, 'database setup marker');
  }

  const gatewayReadyFromLog = input.bootstrapLog.includes(GATEWAY_READY_MARKER);
  const gatewayReadyFromEvidence =
    input.gatewayReady?.apiDocsOk === true &&
    input.gatewayReady?.emptyLoginStatus === 400;

  if (!gatewayReadyFromLog && !gatewayReadyFromEvidence) {
    throw new Error(
      'Missing gateway readiness evidence: expected Gateway is ready. log marker or successful /api-docs + empty login 400 response'
    );
  }

  assertLogMarker(
    input.bootstrapLog,
    PERMISSIONS_MARKER,
    'permissions seed success marker'
  );
  assertLogMarker(
    input.bootstrapLog,
    FINANCE_MARKER,
    'finance seed success marker'
  );

  return {
    ok: true,
    summary: {
      dbSetupVerified: true,
      gatewayReadyVerified: true,
      permissionsSeedVerified: true,
      financeSeedVerified: true,
      financeEvidenceVerified: verifyFinanceEvidence(input.financeEvidence),
      permissionsEvidenceVerified: verifyPermissionsEvidence(
        input.permissionsEvidence
      ),
    },
  };
}
