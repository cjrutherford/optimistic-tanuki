import { DataSource } from 'typeorm';

interface CensusSource {
  census(cursor?: string): Promise<{ communities: Array<{ id: string }>; nextCursor: string | null }>;
}

/** One bounded page. The session lock prevents competing workers from advancing the checkpoint. */
export async function censusPage(db: DataSource, source: CensusSource, reconciler: { census(id: string): Promise<void> }): Promise<'busy' | 'more' | 'complete'> {
  const runner = db.createQueryRunner();
  await runner.connect();
  let locked = false;
  try {
    locked = (await runner.query("SELECT pg_try_advisory_lock(hashtextextended('directory-census-v1', 0)) AS locked"))[0].locked;
    if (!locked) return 'busy';
    await runner.query("INSERT INTO directory_census_progress (id, phase) VALUES ('main','social') ON CONFLICT (id) DO NOTHING");
    const state = (await runner.query("SELECT phase, cursor FROM directory_census_progress WHERE id='main'"))[0];
    if (state.phase !== 'social' && state.phase !== 'directory') throw new Error('Invalid census phase');
    const page = state.phase === 'social'
      ? await source.census(state.cursor || undefined)
      : { communities: await runner.query('SELECT "communityId" AS id FROM directory_town WHERE ($1::uuid IS NULL OR "communityId" > $1::uuid) ORDER BY "communityId" LIMIT 100', [state.cursor]), nextCursor: null };
    for (const row of page.communities) {
      await reconciler.census(row.id);
      await runner.query("UPDATE directory_census_progress SET cursor=$1, \"updatedAt\"=CURRENT_TIMESTAMP WHERE id='main'", [row.id]);
    }
    const more = state.phase === 'social' ? page.nextCursor !== null : page.communities.length === 100;
    if (more) return 'more';
    await runner.query("UPDATE directory_census_progress SET phase=$1, cursor=NULL, \"updatedAt\"=CURRENT_TIMESTAMP WHERE id='main'", [state.phase === 'social' ? 'directory' : 'social']);
    return state.phase === 'social' ? 'more' : 'complete';
  } finally {
    if (locked) await runner.query("SELECT pg_advisory_unlock(hashtextextended('directory-census-v1', 0))");
    await runner.release();
  }
}
