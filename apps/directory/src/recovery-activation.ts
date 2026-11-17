import { DataSource } from 'typeorm';
import { RecoveryIdentity, RecoveryProof } from '../../../libs/social/contracts/src/lib/directory-recovery-proof';

/** The old three-field coordinator cannot establish the six-field authority. */
export async function activateRecovery(_directory: DataSource, _social: DataSource, _identity: RecoveryIdentity, _proof: RecoveryProof, _secret: string): Promise<'enabled' | 'already-enabled'> {
  throw new Error('Legacy recovery activation is disabled; six-field activation protocol is not implemented');
}
