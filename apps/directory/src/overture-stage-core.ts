import {
  createHash,
  KeyObject,
  randomUUID,
  generateKeyPairSync,
  sign,
} from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  authorizeAnonymousAllThePlacesAttempt,
  authorizeAnonymousOvertureAttempt,
} from './provider-budget';
import { normalizeRecord, toStored, type NormalizeProvider } from './normalize';
import { projectLocalEvaluation } from './overture-local-evaluation';
import type { OvertureRightsPolicy } from './overture-rights';

/**
 * Stage logic shared by the operator-local stage scripts and the directory worker's automatic acquisition, so both
 * sign, reserve and project in exactly the same way.
 */
export const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

export interface InventoryItem {
  id: string;
  asset: string;
  etag: string;
  size: number;
  rows: number;
  rowGroups: number;
  bbox: [number, number, number, number];
  lastModified: string;
}
export interface OvertureInventory {
  release: string;
  inventorySha256: string;
  envelope?: [number, number, number, number];
  items: InventoryItem[];
}

/** A one-process signing identity. The grant it signs is verified by `authorizeAnonymousOvertureAttempt` in the same process. */
export interface StageSigner {
  publicKey: KeyObject;
  privateKey: KeyObject;
  subject: string;
}
export function newStageSigner(): StageSigner {
  const keys = generateKeyPairSync('ed25519');
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: randomUUID(),
  };
}

/**
 * `reserveAttempt` for the pinned range proxy: signs a short-lived anonymous GET/HEAD grant for one asset and records it
 * in the budget ledger (`directory_anonymous_overture_attempt`). Refuses while the kill switch is on or the policy row
 * is revoked. `automatic` is the worker's path and needs no DIRECTORY_LOCAL_EVALUATION flag.
 */
export function anonymousAttemptReserver(
  budget: DataSource,
  input: {
    approvalSha256: string;
    item: Pick<InventoryItem, 'asset' | 'etag'>;
    signer: StageSigner;
    automatic?: boolean;
    /** The anonymous-read ledger entry point; Overture unless the standalone AllThePlaces archive is being read. */
    provider?: 'overture' | 'alltheplaces';
  }
) {
  const authorize =
    input.provider === 'alltheplaces'
      ? authorizeAnonymousAllThePlacesAttempt
      : authorizeAnonymousOvertureAttempt;
  return (attempt: Parameters<typeof authorizeAnonymousOvertureAttempt>[3]) => {
    const now = Date.now(),
      claims = {
        version: 's4-private-source-v1',
        policyId: input.approvalSha256,
        subject: input.signer.subject,
        assetSha256: sha256Hex(input.item.asset),
        etag: input.item.etag,
        methods: ['GET', 'HEAD'],
        maxCostCents: 1,
        issuedAt: now - 1000,
        expiresAt: now + 600000,
      },
      payload = Buffer.from(JSON.stringify(claims)).toString('base64url'),
      signature = sign(
        null,
        Buffer.from(payload),
        input.signer.privateKey
      ).toString('base64url');
    return authorize(
      budget,
      input.signer.publicKey,
      { payload, signature },
      attempt,
      { automatic: input.automatic === true }
    );
  };
}

/**
 * The extractor's `project` callback: the conservative local-evaluation screen under the supplied rights policy. A
 * thrown projection is a quarantine, never a partial listing. `assignmentChangeToken`, when given, pins the row to the
 * town's current assignment (the Census stage); the plain stage and the automatic sweep leave it unset.
 */
/** The source records the private sink accepts (dataset and license present, a JSON-pointer property), at most 20. */
export function privateSources(
  value: unknown
): { property?: string; dataset: string; license: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { property?: string; dataset: string; license: string }[] = [];
  for (const entry of value) {
    if (out.length === 20) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const { dataset, license, property } = entry as Record<string, unknown>;
    if (
      typeof dataset !== 'string' ||
      !dataset.trim() ||
      dataset.length > 200 ||
      typeof license !== 'string' ||
      !license.trim() ||
      license.length > 200
    )
      continue;
    if (
      property !== undefined &&
      (typeof property !== 'string' ||
        property.length > 500 ||
        (property !== '' && !property.startsWith('/')))
    )
      continue;
    out.push(
      typeof property === 'string'
        ? { property, dataset, license }
        : { dataset, license }
    );
  }
  return out;
}

export function projectStagedRow(input: {
  source: Record<string, unknown> & { geometry?: unknown };
  releaseId: string;
  rights: OvertureRightsPolicy;
  assignmentChangeToken?: string;
  provider?: NormalizeProvider;
}): { status: 'eligible' | 'quarantined'; listing?: any } {
  try {
    const geometry =
      typeof input.source.geometry === 'string'
        ? JSON.parse(input.source.geometry)
        : input.source.geometry;
    const outcome = projectLocalEvaluation(
      {
        ...input.source,
        geometry,
        releaseId: input.releaseId,
        assignedCategoryIds: ['local'],
      } as never,
      input.rights
    ) as { status: 'eligible' | 'quarantined'; listing?: any };
    if (outcome.status === 'eligible' && input.assignmentChangeToken)
      outcome.listing.assignmentChangeToken = input.assignmentChangeToken;
    if (outcome.status === 'eligible' && outcome.listing) {
      // The rights evaluator reads field provenance from the stored listing; a row without it can never be exported.
      const sources = privateSources(input.source['sources']);
      if (sources.length) outcome.listing.sources = sources;
      // The shared normalize stage (D27): derived keys and states stored beside the raw name and category.
      outcome.listing.normalized = toStored(
        normalizeRecord(input.provider ?? 'overture', {
          ...input.source,
          geometry,
        })
      );
    }
    return outcome;
  } catch {
    return { status: 'quarantined' };
  }
}
