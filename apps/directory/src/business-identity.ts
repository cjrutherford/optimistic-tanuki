import { createHash, createHmac } from 'node:crypto';

/**
 * Cross-release business identity: keyed hashing of the upstream id and the
 * pure classifier that decides, for a new cohort, which rows may inherit an
 * existing business. Nothing here touches a database, logs a value, or matches
 * on anything but an equal upstream key (see S5-item1-business-identity-design.md).
 */

/** Bumped when the hash construction changes; a mismatch reads as "no key". */
export const BUSINESS_IDENTITY_KEY_VERSION = 1;
const MAX_UPSTREAM_ID_LENGTH = 128;

/** Reads the Directory-held key from the environment; never logs it. Returns null when unset. */
export function businessIdentityKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY;
  if (key === undefined || key === '') return null;
  if (key.length < 32) throw Error('DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY must be at least 32 characters');
  return key;
}

function requireKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || key.length < 32) throw Error('A business identity key of at least 32 characters is required');
}

/** The keyed hash of an upstream id, or null when the id cannot be used as a key. */
export function upstreamKeyHash(key: string, id: unknown): string | null {
  requireKey(key);
  if (typeof id !== 'string' || !id.trim() || id.length > MAX_UPSTREAM_ID_LENGTH) return null;
  return createHmac('sha256', key).update(`business-identity-v1\0${id}`).digest('hex');
}

/** Keyed hash of the normalised name. Used only by the drift guard, never to find a match. */
export function businessNameHash(key: string, name: unknown): string | null {
  requireKey(key);
  if (typeof name !== 'string') return null;
  const normal = name.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
  return normal ? createHmac('sha256', key).update(`business-name-v1\0${normal}`).digest('hex') : null;
}

export type BusinessState = 'active' | 'retired' | 'merged' | 'split';

/** One row of the target cohort that has a source key (or none). */
export interface CohortRow {
  readonly scanId: string;
  readonly sourceFileRowNumber: string | number;
  readonly upstreamKeyHash: string | null;
  readonly nameHash: string | null;
}

/** The current assertion of a business in the same town, from the previous cohort. */
export interface PredecessorAssertion {
  readonly businessId: string;
  readonly businessState: BusinessState;
  readonly upstreamKeyHash: string | null;
  readonly nameHash: string | null;
}

export type UnresolvedCause = 'duplicate' | 'conflict' | 'inactive_predecessor';
export type Verdict =
  | { readonly kind: 'carry'; readonly businessId: string; readonly nameChanged: boolean }
  | { readonly kind: 'new' }
  | { readonly kind: 'unresolved'; readonly cause: UnresolvedCause };

export interface ClassifiedRow {
  readonly scanId: string;
  readonly sourceFileRowNumber: string;
  readonly upstreamKeyHash: string | null;
  readonly verdict: Verdict;
}

export interface CohortPlan {
  readonly rows: readonly ClassifiedRow[];
  readonly digest: string;
}

const rowOrder = (a: { scanId: string; sourceFileRowNumber: string }, b: { scanId: string; sourceFileRowNumber: string }) =>
  a.scanId < b.scanId ? -1 : a.scanId > b.scanId ? 1 : BigInt(a.sourceFileRowNumber) < BigInt(b.sourceFileRowNumber) ? -1 : BigInt(a.sourceFileRowNumber) > BigInt(b.sourceFileRowNumber) ? 1 : 0;

const verdictText = (v: Verdict): string =>
  v.kind === 'carry' ? `carry:${v.businessId}:${v.nameChanged ? 'name_changed' : 'same_name'}` : v.kind === 'unresolved' ? `unresolved:${v.cause}` : 'new';

/**
 * Classifies every cohort row. The verdict depends only on two sets: the key
 * hashes in the cohort and the key hashes on the town's businesses, so input
 * order never changes the outcome or the digest. Any ambiguity fails closed:
 * nothing is carried by row number, name, position, or "the only candidate".
 */
export function classifyCohort(cohort: readonly CohortRow[], predecessors: readonly PredecessorAssertion[]): CohortPlan {
  const inCohort = new Map<string, number>();
  for (const row of cohort) if (row.upstreamKeyHash) inCohort.set(row.upstreamKeyHash, (inCohort.get(row.upstreamKeyHash) ?? 0) + 1);
  const byHash = new Map<string, Map<string, PredecessorAssertion[]>>();
  for (const p of predecessors) {
    if (!p.upstreamKeyHash) continue;
    const businesses = byHash.get(p.upstreamKeyHash) ?? new Map<string, PredecessorAssertion[]>();
    businesses.set(p.businessId, [...(businesses.get(p.businessId) ?? []), p]);
    byHash.set(p.upstreamKeyHash, businesses);
  }

  const verdictFor = (row: CohortRow): Verdict => {
    const hash = row.upstreamKeyHash;
    if (!hash) return { kind: 'new' };
    if ((inCohort.get(hash) ?? 0) > 1) return { kind: 'unresolved', cause: 'duplicate' };
    const businesses = byHash.get(hash);
    if (!businesses || !businesses.size) return { kind: 'new' };
    const live = [...businesses.values()].filter((list) => list[0].businessState !== 'retired');
    if (live.length > 1) return { kind: 'unresolved', cause: 'conflict' };
    if (live.length === 0) return { kind: 'unresolved', cause: 'inactive_predecessor' };
    const assertions = live[0];
    if (assertions.some((a) => a.businessState !== 'active')) return { kind: 'unresolved', cause: 'inactive_predecessor' };
    // One business may be asserted by several rows of the previous cohort; disagreeing names are a drift, never a tie-break.
    const names = new Set(assertions.map((a) => a.nameHash));
    const nameChanged = names.size !== 1 || !row.nameHash || !names.has(row.nameHash);
    return { kind: 'carry', businessId: assertions[0].businessId, nameChanged };
  };

  const rows = cohort
    .map((row): ClassifiedRow => ({ scanId: row.scanId, sourceFileRowNumber: String(row.sourceFileRowNumber), upstreamKeyHash: row.upstreamKeyHash, verdict: verdictFor(row) }))
    .sort(rowOrder);
  const digest = createHash('sha256');
  for (const row of rows) digest.update(`${row.upstreamKeyHash ?? ''}\t${row.scanId}\t${row.sourceFileRowNumber}\t${verdictText(row.verdict)}\n`);
  return { rows, digest: digest.digest('hex') };
}
