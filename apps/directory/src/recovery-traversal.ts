import { DataSource, QueryRunner } from 'typeorm';
import { isEligibleCommunity, SocialCommunitySnapshot } from './social-eligibility';

type Identity = { sourceEpoch: string; recoveryEpoch: string; owner: string; activationId: string; socialGeneration: string; directoryGeneration: string };
type Source = { census(cursor: string | undefined, epoch: string): Promise<{ communities: Array<{id: string}>; nextCursor: string | null }>; snapshot(id: string, epoch: string): Promise<SocialCommunitySnapshot | null> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const key = "hashtextextended('directory-recovery-authority-v1', 0)";

async function state(runner: QueryRunner, identity: Identity) {
  const rows = await runner.query(`SELECT p.*, i."recoveryEpoch" AS authority FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR UPDATE OF p, i`);
  const p = rows[0];
  if (rows.length !== 1 || p.sourceEpoch !== identity.sourceEpoch || p.recoveryEpoch !== identity.recoveryEpoch || p.authority !== identity.recoveryEpoch) throw Error('Recovery epoch mismatch');
  if (p.protocol !== 'legacy') throw Error('Recovery protocol mismatch');
  if (p.owner !== identity.owner) throw Error('Recovery owner mismatch');
  if (p.activationId !== identity.activationId || p.socialGeneration !== identity.socialGeneration || p.directoryGeneration !== identity.directoryGeneration) throw Error('Recovery identity mismatch');
  if (!['blocked', 'social', 'directory', 'traversed'].includes(p.phase) || (p.cursor !== null && !uuid.test(p.cursor)) || (['blocked', 'traversed'].includes(p.phase) && p.cursor !== null)) throw Error('Invalid recovery checkpoint');
  return p;
}

/** A bounded operator-invoked pass. Traversed is not recovery completion. */
export async function recoveryPage(db: DataSource, source: Source, identity: Identity): Promise<'busy' | 'more' | 'traversed'> {
  if (![identity.sourceEpoch, identity.recoveryEpoch, identity.owner, identity.activationId].every(x => typeof x === 'string' && uuid.test(x)) || ![identity.socialGeneration, identity.directoryGeneration].every(x => typeof x === 'string' && /^[1-9][0-9]*$/.test(x))) throw Error('Invalid recovery identity');
  const r = db.createQueryRunner(); await r.connect(); let locked = false;
  try {
    locked = (await r.query(`SELECT pg_try_advisory_lock(${key}) AS locked`))[0].locked;
    if (!locked) return 'busy';
    await r.startTransaction(); let p;
    try { p = await state(r, identity); await r.commitTransaction(); } catch (e) { await r.rollbackTransaction(); throw e; }
    // Even an empty Directory pass must confirm the fenced Social epoch.
    const social = await source.census(p.phase === 'social' ? p.cursor || undefined : undefined, identity.sourceEpoch);
    if (!social || !Array.isArray(social.communities) || social.communities.length > 100 || !(social.nextCursor === null || typeof social.nextCursor === 'string')) throw Error('Invalid census response');
    let previous = p.phase === 'social' ? p.cursor : null;
    for (const row of social.communities) { if (!row || !uuid.test(row.id) || (previous && row.id <= previous)) throw Error('Invalid census ordering'); previous = row.id; }
    if (social.nextCursor !== null && (!social.communities.length || social.nextCursor !== previous)) throw Error('Invalid census cursor');
    if (p.phase === 'traversed') return 'traversed';
    if (p.phase === 'blocked') {
      await r.startTransaction(); try { await state(r, identity); await r.query("UPDATE directory_census_progress SET phase='social', cursor=NULL, \"updatedAt\"=CURRENT_TIMESTAMP WHERE id='recovery'"); await r.commitTransaction(); } catch (e) { await r.rollbackTransaction(); throw e; }
      p.phase = 'social';
    }
    const rows: Array<{id: string}> = p.phase === 'social' ? social.communities : await r.query('SELECT "communityId" AS id FROM directory_town WHERE ($1::uuid IS NULL OR "communityId" > $1::uuid) ORDER BY "communityId" LIMIT 100', [p.cursor]);
    for (const {id} of rows) {
      await r.startTransaction();
      try {
        const currentState = await state(r, identity);
        if (currentState.phase !== p.phase || currentState.cursor !== p.cursor) throw Error('Recovery checkpoint changed');
        await r.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [id]);
        const current = await source.snapshot(id, identity.sourceEpoch);
        if (current !== null && (!current || current.id !== id || typeof current.name !== 'string' || !(current.slug === null || typeof current.slug === 'string') || !(current.adminArea === null || typeof current.adminArea === 'string') || typeof current.appScope !== 'string' || typeof current.isPrivate !== 'boolean' || !(current.localityType === null || typeof current.localityType === 'string'))) throw Error('Invalid snapshot');
        if (current && isEligibleCommunity(current)) {
          await r.query(`INSERT INTO directory_town ("communityId", name, slug, "administrativeArea", eligible, "geometryStatus") VALUES ($1,$2,$3,$4,true,'pending') ON CONFLICT ("communityId") DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, "administrativeArea"=EXCLUDED."administrativeArea", eligible=true, "geometryStatus"='pending'`, [id, current.name, current.slug, current.adminArea]);
          await r.query(`INSERT INTO directory_provider_work ("communityId", status) VALUES ($1,'blocked') ON CONFLICT ("communityId") DO UPDATE SET status='blocked', "updatedAt"=CURRENT_TIMESTAMP`, [id]);
        } else {
          await r.query(`UPDATE directory_town SET eligible=false, "geometryStatus"='pending' WHERE "communityId"=$1`, [id]);
          await r.query('DELETE FROM directory_provider_work WHERE "communityId"=$1', [id]);
        }
        await r.query(`UPDATE directory_census_progress SET cursor=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE id='recovery'`, [id]);
        await r.commitTransaction(); p.cursor = id;
      } catch (e) { await r.rollbackTransaction(); throw e; }
    }
    if (p.phase === 'social' ? social.nextCursor !== null : rows.length === 100) return 'more';
    await r.startTransaction();
    try { const current = await state(r, identity); if (current.phase !== p.phase || current.cursor !== p.cursor) throw Error('Recovery checkpoint changed'); await r.query('UPDATE directory_census_progress SET phase=$1, cursor=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=\'recovery\'', [p.phase === 'social' ? 'directory' : 'traversed']); await r.commitTransaction(); } catch (e) { await r.rollbackTransaction(); throw e; }
    return p.phase === 'social' ? 'more' : 'traversed';
  } finally { if (locked) await r.query(`SELECT pg_advisory_unlock(${key})`); await r.release(); }
}
