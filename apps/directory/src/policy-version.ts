import { createHash } from 'node:crypto';

/**
 * Opaque page label: a short stable hash over the sorted ids of the source policies that can produce a page
 * (active, with a completed scan) and the serving generation bound into cursors. A policy id is itself the
 * digest of its serialized policy, so a changed policy is a new id and changes the label. Raw ids never leave.
 */
export const POLICY_VERSION_PATTERN = /^[0-9a-f]{16}$/;

export function derivePolicyVersion(
  policyIds: readonly string[],
  generation?: string
): string | undefined {
  const ids = [
    ...new Set(
      policyIds.filter((i) => typeof i === 'string' && /^[0-9a-f]{64}$/.test(i))
    ),
  ].sort();
  if (!ids.length) return undefined;
  return createHash('sha256')
    .update('policy-version-v1\0')
    .update(ids.join(','))
    .update('\0')
    .update(generation ?? '')
    .digest('hex')
    .slice(0, 16);
}

type Q = { query: (sql: string, params?: unknown[]) => Promise<any> };

export async function currentPolicyVersion(
  db: Q,
  generation?: string
): Promise<string | undefined> {
  const rows = await db.query(
    `SELECT p."policyId" FROM directory_overture_private_policy p
      WHERE p.revoked=false AND EXISTS (SELECT 1 FROM directory_overture_private_membership m JOIN directory_overture_private_completion c ON c."scanId"=m."scanId" WHERE m."policyId"=p."policyId")
      ORDER BY p."policyId"`
  );
  return derivePolicyVersion(
    Array.isArray(rows)
      ? rows.map((r: { policyId?: string }) => r?.policyId ?? '')
      : [],
    generation
  );
}
