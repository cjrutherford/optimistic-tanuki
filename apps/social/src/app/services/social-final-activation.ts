import { DataSource } from 'typeorm';
import { RecoveryIdentity } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';
import { OperatorAttestation, OperatorKeySet, operatorAttestationDigest, verifyOperatorAttestation } from '../../../../../libs/social/contracts/src/lib/directory-operator-attestation';

const hex = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const count = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v);
const fields = ['sourceEpoch', 'recoveryEpoch', 'owner', 'activationId', 'socialGeneration', 'directoryGeneration'] as const;
const validPrepared = (p: any) => p && Object.keys(p).sort().join(',') === 'digest,retirementCount,retirementDigest,version' && p.version === 'social-traversal-v2' && hex(p.digest) && count(p.retirementCount) && hex(p.retirementDigest);

/** Operator-only. The external all-writer and serving fence must remain in place throughout. */
export async function activateSocial(social: DataSource, directory: DataSource, identity: RecoveryIdentity, prepared: OperatorAttestation, enabled: OperatorAttestation, keys: OperatorKeySet, externalFence: boolean): Promise<'active' | 'already-active'> {
  if (externalFence !== true) throw new Error('External fence confirmation required');
  const d = directory.createQueryRunner(), s = social.createQueryRunner();
  let dt = false, st = false;
  try {
    await d.connect(); await d.startTransaction(); dt = true;
    await d.query("SET LOCAL lock_timeout = '2s'"); await d.query("SET LOCAL statement_timeout = '10s'");
    await d.query("SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))");
    const checkpoints = await d.query(`SELECT p.*, i."recoveryEpoch" AS authority FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR UPDATE OF p, i`);
    const c = checkpoints[0], ep = c?.enabledPayload;
    if (checkpoints.length !== 1 || !identity || c.authority !== identity.recoveryEpoch || fields.some(k => c[k] !== identity[k]) || c.phase !== 'enabled' || c.cursor !== null || !ep || Object.keys(ep).sort().join(',') !== 'preparedDigest,retirementCount,retirementDigest,version' || ep.version !== 'directory-enabled-v1' || !hex(ep.preparedDigest) || !count(ep.retirementCount) || !hex(ep.retirementDigest)) throw new Error('Invalid Directory enabled checkpoint');
    verifyOperatorAttestation(enabled, 'directory-enabled', identity, { version: 'social-prepared-v1', digest: ep.preparedDigest }, keys);
    await s.connect(); await s.startTransaction(); st = true;
    await s.query("SET LOCAL lock_timeout = '2s'"); await s.query("SET LOCAL statement_timeout = '10s'");
    const rows = await s.query('SELECT * FROM community_directory_epoch WHERE id=1 FOR UPDATE');
    const row = rows[0], active = row?.phase === 'active' && row.fenced === false;
    const stored = row?.preparedPayload, p = active ? stored?.prepared : stored;
    if (rows.length !== 1 || row.sourceEpoch !== identity.sourceEpoch || row.directoryRecoveryEpoch !== identity.recoveryEpoch || row.owner !== identity.owner || row.activationId !== identity.activationId || row.socialGeneration !== identity.socialGeneration || row.directoryGeneration !== identity.directoryGeneration || !validPrepared(p)) throw new Error('Invalid Social prepared authority');
    verifyOperatorAttestation(prepared, 'social-prepared', identity, { version: p.version, digest: p.digest }, keys);
    if (operatorAttestationDigest(prepared) !== ep.preparedDigest) throw new Error('Social prepared digest mismatch');
    const accepted = { version: 'directory-enabled-v1', digest: operatorAttestationDigest(enabled) };
    if (active) {
      if (!stored || Object.keys(stored).sort().join(',') !== 'accepted,prepared' || !stored.accepted || Object.keys(stored.accepted).sort().join(',') !== 'digest,version' || stored.accepted.version !== accepted.version || stored.accepted.digest !== accepted.digest) throw new Error('Active Social authority mismatch');
    } else {
      if (row.phase !== 'prepared' || row.fenced !== true) throw new Error('Invalid Social authority phase');
      await s.query(`UPDATE community_directory_epoch SET phase='active', fenced=false, "preparedPayload"=$1::jsonb, "updatedAt"=now() WHERE id=1`, [JSON.stringify({prepared:p, accepted})]);
    }
    await s.commitTransaction(); st = false;
    await d.commitTransaction(); dt = false;
    return active ? 'already-active' : 'active';
  } finally {
    if (st) await s.rollbackTransaction();
    if (!s.isReleased) await s.release();
    if (dt) await d.rollbackTransaction();
    if (!d.isReleased) await d.release();
  }
}
