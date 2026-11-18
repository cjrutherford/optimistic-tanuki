import { DataSource } from 'typeorm';

/**
 * Owner-decided town merges and retirements (S10 D19-D26).
 *
 * Social owns which communities exist: the absorbed community is retired there first (its register entry then
 * reconciles to an ineligible directory town). This only records, on the Directory side, which town absorbed it, so
 * the pointer is not lost when the register blanks the absorbed town's name. Reconciliation clears the pointer if
 * Social ever reports the absorbed community eligible again.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type TownMergeStatus = 'merged' | 'unchanged' | 'would-merge';
export interface TownMergeResult {
  status: TownMergeStatus;
}

async function lockTown(
  manager: { query: (sql: string, params?: unknown[]) => Promise<any> },
  communityId: string
): Promise<void> {
  // Same serialization the locked-boundary install and the register reconcile use.
  await manager.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended('directory-recovery-authority-v1', 0))"
  );
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    communityId,
  ]);
}

/**
 * Records that `communityId` was merged into `intoCommunityId`. Refuses unless the absorbed town is already
 * ineligible (Social has retired it) and the target town exists and is eligible. Idempotent.
 */
export async function mergeTownInto(
  db: DataSource,
  input: { communityId: string; intoCommunityId: string },
  options: { dryRun?: boolean } = {}
): Promise<TownMergeResult> {
  if (
    !uuid.test(input?.communityId || '') ||
    !uuid.test(input?.intoCommunityId || '') ||
    input.communityId === input.intoCommunityId
  )
    throw Error('Invalid town merge request');
  return db.transaction(async (manager) => {
    // Lock in id order so two merges can never deadlock.
    for (const id of [input.communityId, input.intoCommunityId].sort())
      await lockTown(manager, id);
    const [source] = await manager.query(
      'SELECT eligible,"mergedIntoCommunityId" AS "mergedInto" FROM directory_town WHERE "communityId"=$1 FOR UPDATE',
      [input.communityId]
    );
    if (!source) throw Error('Unknown town');
    const [target] = await manager.query(
      'SELECT eligible,"mergedIntoCommunityId" AS "mergedInto" FROM directory_town WHERE "communityId"=$1',
      [input.intoCommunityId]
    );
    if (!target) throw Error('Unknown merge target');
    if (target.eligible !== true) throw Error('Eligible merge target required');
    if (target.mergedInto) throw Error('Merge target is itself merged');
    if (source.mergedInto === input.intoCommunityId)
      return { status: 'unchanged' } as TownMergeResult;
    if (source.eligible === true)
      throw Error('Town is still eligible; retire it in Social first');
    if (options.dryRun) return { status: 'would-merge' } as TownMergeResult;
    await manager.query(
      'UPDATE directory_town SET "mergedIntoCommunityId"=$2 WHERE "communityId"=$1',
      [input.communityId, input.intoCommunityId]
    );
    return { status: 'merged' } as TownMergeResult;
  });
}

export type TownRetireStatus =
  | 'retired'
  | 'absent'
  | 'would-retire'
  | 'kept-has-data';
export interface TownRetireResult {
  status: TownRetireStatus;
  /** Tables that still hold rows for the town when it is kept. */
  referencedBy?: string[];
}

/**
 * Removes a blank-name, ineligible directory town (a community Social no longer reports). It is deleted only when
 * no table holds rows for it besides the register row itself; otherwise it is left as it is and reported.
 */
export async function retireBlankTown(
  db: DataSource,
  input: { communityId: string },
  options: { dryRun?: boolean } = {}
): Promise<TownRetireResult> {
  if (!uuid.test(input?.communityId || '')) throw Error('Invalid town');
  return db.transaction(async (manager) => {
    await lockTown(manager, input.communityId);
    const [town] = await manager.query(
      'SELECT name,eligible FROM directory_town WHERE "communityId"=$1 FOR UPDATE',
      [input.communityId]
    );
    if (!town) return { status: 'absent' } as TownRetireResult;
    if (town.eligible !== false || town.name !== '')
      throw Error('Only a blank-name ineligible town can be retired');
    const tables: Array<{ table_name: string }> = await manager.query(
      `SELECT DISTINCT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
       WHERE c.table_schema='public' AND c.column_name='communityId' AND c.table_name<>'directory_town' ORDER BY 1`
    );
    const referencedBy: string[] = [];
    for (const { table_name } of tables) {
      const [row] = await manager.query(
        `SELECT 1 AS found FROM "${table_name.replace(
          /"/g,
          '""'
        )}" WHERE "communityId"=$1 LIMIT 1`,
        [input.communityId]
      );
      if (row) referencedBy.push(table_name);
    }
    if (referencedBy.length)
      return { status: 'kept-has-data', referencedBy } as TownRetireResult;
    if (options.dryRun) return { status: 'would-retire' } as TownRetireResult;
    await manager.query('DELETE FROM directory_town WHERE "communityId"=$1', [
      input.communityId,
    ]);
    return { status: 'retired' } as TownRetireResult;
  });
}
