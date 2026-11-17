import { DataSource, EntityManager } from 'typeorm';
import { lockSocialRuntimeAuthority } from './social-authority';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = /^[1-9][0-9]*$/;
const hex = /^[0-9a-f]{64}$/;
const count = /^(0|[1-9][0-9]*)$/;
const identityFields = ['sourceEpoch', 'recoveryEpoch', 'owner', 'activationId', 'socialGeneration', 'directoryGeneration'] as const;

/**
 * Experimental transaction boundary. Both stores must use READ COMMITTED, and every
 * Directory refence must acquire the exclusive directory-recovery-authority-v1
 * advisory lock. The callback may only modify Social through its manager; it must
 * not publish side effects. This is not a distributed atomic commit.
 *
 * Do not wire this into serving until connection-loss and all-writer fencing are
 * solved. In particular, a Directory connection can die while Social commits.
 */
export async function withDirectoryPeerAuthority<T>(directory: DataSource, social: DataSource, work: (manager: EntityManager) => Promise<T>): Promise<T> {
  const d = directory.createQueryRunner();
  const s = social.createQueryRunner();
  let dt = false, st = false;
  try {
    await d.connect();
    await d.startTransaction('READ COMMITTED'); dt = true;
    await d.query("SET LOCAL lock_timeout = '2s'");
    await d.query("SET LOCAL statement_timeout = '10s'");
    await d.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('directory-recovery-authority-v1', 0))");
    const rows = await d.query(`SELECT p."sourceEpoch", p."recoveryEpoch", p.owner, p."activationId", p."socialGeneration", p."directoryGeneration", p.phase, p.cursor, p."enabledPayload", i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery'`);
    const peer = rows[0], enabled = peer?.enabledPayload;
    if (rows.length !== 1 || peer.phase !== 'enabled' || peer.cursor !== null || peer.authorityEpoch !== peer.recoveryEpoch ||
        ![peer.sourceEpoch, peer.recoveryEpoch, peer.owner, peer.activationId].every(v => typeof v === 'string' && uuid.test(v)) ||
        ![peer.socialGeneration, peer.directoryGeneration].every(v => typeof v === 'string' && generation.test(v)) ||
        !enabled || Object.keys(enabled).sort().join(',') !== 'preparedDigest,retirementCount,retirementDigest,version' || enabled.version !== 'directory-enabled-v1' ||
        typeof enabled.preparedDigest !== 'string' || !hex.test(enabled.preparedDigest) || typeof enabled.retirementDigest !== 'string' || !hex.test(enabled.retirementDigest) || typeof enabled.retirementCount !== 'string' || !count.test(enabled.retirementCount)) throw new Error('invalid peer');
    await s.connect();
    await s.startTransaction('READ COMMITTED'); st = true;
    await s.query("SET LOCAL lock_timeout = '2s'");
    await s.query("SET LOCAL statement_timeout = '10s'");
    const local = await lockSocialRuntimeAuthority(s.manager, { sourceEpoch: peer.sourceEpoch, recoveryEpoch: peer.recoveryEpoch });
    const localIdentity = { ...local, recoveryEpoch: local.directoryRecoveryEpoch };
    if (identityFields.some(field => localIdentity[field] !== peer[field])) throw new Error('identity mismatch');
    const result = await work(s.manager);
    // Detect an already-lost peer before committing, but this cannot close the
    // connection-loss window between this query and the Social commit.
    await d.query('SELECT 1');
    await s.commitTransaction(); st = false;
    await d.commitTransaction(); dt = false;
    return result;
  } catch {
    // Do not leak driver messages, connection strings or credentials.
    throw new Error('Directory peer authority unavailable');
  } finally {
    if (st) await s.rollbackTransaction().catch(() => undefined);
    if (!s.isReleased) await s.release().catch(() => undefined);
    if (dt) await d.rollbackTransaction().catch(() => undefined);
    if (!d.isReleased) await d.release().catch(() => undefined);
  }
}
