import { createHmac, timingSafeEqual } from 'node:crypto';
import { RecoveryIdentity } from './directory-recovery-proof';

/** An authenticated assertion, not proof that a Directory transaction committed or survived restore. */
export type DirectoryRegisterReceipt = RecoveryIdentity & {
  version: 'directory-register-receipt-v1';
  communityId: string;
  changeToken: string;
  signature: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = /^[1-9][0-9]*$/;
const identityKeys = ['sourceEpoch', 'recoveryEpoch', 'owner', 'activationId', 'socialGeneration', 'directoryGeneration'] as const;
const keys = [...identityKeys, 'version', 'communityId', 'changeToken', 'signature'].sort().join(',');

/** Authenticate the entire receipt against a separately supplied authority and token.
 * This check alone must never authorize an ACK: commit, freshness and recovery are separate obligations. */
export function verifyDirectoryRegisterReceipt(receipt: DirectoryRegisterReceipt, expected: RecoveryIdentity & { communityId: string; changeToken: string }, secret: string): void {
  const fail = () => { throw new Error('Invalid directory register receipt'); };
  if (!receipt || typeof receipt !== 'object' || Object.keys(receipt).sort().join(',') !== keys || !expected || typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) return fail();
  const values = [receipt.sourceEpoch, receipt.recoveryEpoch, receipt.owner, receipt.activationId, receipt.communityId, receipt.changeToken];
  if (!values.every(value => typeof value === 'string' && uuid.test(value)) || ![receipt.socialGeneration, receipt.directoryGeneration].every(value => typeof value === 'string' && generation.test(value) && (value.length < 19 || (value.length === 19 && value <= '9223372036854775807'))) || receipt.version !== 'directory-register-receipt-v1' || ([...identityKeys, 'communityId', 'changeToken'] as const).some(key => receipt[key] !== expected[key]) || typeof receipt.signature !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.signature)) return fail();
  const parts = [receipt.version, ...identityKeys.map(key => receipt[key]), receipt.communityId, receipt.changeToken];
  const canonical = 'directory-register-receipt:' + parts.map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`).join('');
  const mac = createHmac('sha256', secret).update(canonical).digest();
  if (!timingSafeEqual(mac, Buffer.from(receipt.signature, 'hex'))) fail();
}
