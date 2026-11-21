import { DataSource } from 'typeorm';
import {
  RecoveryIdentity,
  RecoveryProof,
  signRecoveryProof,
} from '../../../libs/social/contracts/src/lib/directory-recovery-proof';

/** Operator only; all old writers and serving processes must already be externally fenced. */
export async function generateRecoveryProof(
  db: DataSource,
  identity: RecoveryIdentity,
  secret: string
): Promise<RecoveryProof> {
  // Validate before entering the transaction; the actual signature is made only under the lock.
  if (!identity || typeof secret !== 'string')
    throw new Error('Invalid recovery authority');
  return db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
    );
    const rows = await manager.query(
      `SELECT p.*, i."recoveryEpoch" AS authority FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR UPDATE OF p, i`
    );
    const p = rows[0];
    if (
      rows.length !== 1 ||
      p.sourceEpoch !== identity.sourceEpoch ||
      p.recoveryEpoch !== identity.recoveryEpoch ||
      p.authority !== identity.recoveryEpoch ||
      p.owner !== identity.owner ||
      p.activationId !== identity.activationId ||
      p.socialGeneration !== identity.socialGeneration ||
      p.directoryGeneration !== identity.directoryGeneration
    )
      throw new Error('Recovery authority mismatch');
    if (p.protocol !== 'legacy') throw new Error('Recovery protocol mismatch');
    // The only transition to traversed is directory -> traversed, after social -> directory.
    if (p.phase !== 'traversed' || p.cursor !== null)
      throw new Error('Recovery checkpoint is not traversed');
    return signRecoveryProof(identity, secret);
  });
}
