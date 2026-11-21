import {
  DeletionIdentityKind,
  deletionIdentityKey,
} from '../../../libs/storage/src/lib/account-deletion-write-fence';

type Query = { query(sql: string, params?: unknown[]): Promise<any[]> };

/** Only identifiers of this exact shape can be named by a deletion grant. */
const FENCEABLE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KINDS: readonly DeletionIdentityKind[] = [
  'account',
  'profile',
  'legacy-profile',
];

export const ACCOUNT_DELETION_FENCED = 'ACCOUNT_DELETION_FENCED';

/**
 * Directory's identity columns are bare UUIDs written from more than one
 * domain, so a write is refused when its identifier is fenced under any kind.
 * Keys are locked in the installer's order (sorted) so a concurrent fence
 * installation and a write on the same identity always serialize.
 */
export function directoryFenceKeys(
  ids: readonly (string | null | undefined)[]
): string[] {
  const keys = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.toLowerCase();
    if (!FENCEABLE_UUID.test(id)) continue;
    for (const kind of KINDS) keys.add(deletionIdentityKey(kind, id));
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/**
 * Must run inside the writer's transaction, before the row locks it takes.
 * The advisory locks are held to commit, so a fence installed afterwards waits
 * for this write and the erase that follows sees it.
 */
export async function assertDirectoryIdentitiesUnfenced(
  tx: Query,
  ids: readonly (string | null | undefined)[]
): Promise<void> {
  const keys = directoryFenceKeys(ids);
  if (!keys.length) return;
  for (const key of keys)
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      key,
    ]);
  const rows = await tx.query(
    'SELECT 1 FROM account_deletion_write_fence WHERE "key" = ANY($1::text[]) LIMIT 1',
    [keys]
  );
  if (!Array.isArray(rows) || rows.length) throw Error(ACCOUNT_DELETION_FENCED);
}
