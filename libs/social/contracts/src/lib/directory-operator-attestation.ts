import { createHash, createPrivateKey, createPublicKey, KeyObject, sign, verify } from 'node:crypto';
import { RecoveryIdentity } from './directory-recovery-proof';

type Key = string | Buffer | KeyObject;
type Purpose = 'social-prepared' | 'directory-enabled';
type Prerequisite = { version: string; digest: string };
export type OperatorKeySet = { socialPublicKey: Key; directoryPublicKey: Key; socialKeyId: string; directoryKeyId: string };
export type OperatorAttestation = RecoveryIdentity & Prerequisite & { protocolVersion: 'directory-operator-attestation-v1'; purpose: Purpose; issuer: 'social' | 'directory'; audience: 'directory' | 'social'; keyId: string; signature: string };
const protocolVersion = 'directory-operator-attestation-v1' as const;
const identityFields = ['sourceEpoch', 'recoveryEpoch', 'owner', 'activationId', 'socialGeneration', 'directoryGeneration'] as const;
const fields = ['protocolVersion', 'purpose', 'issuer', 'audience', 'keyId', ...identityFields, 'version', 'digest'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function publicKey(key: Key): KeyObject {
  const result = key instanceof KeyObject && key.type === 'public' ? key : createPublicKey(key);
  if (result.asymmetricKeyType !== 'ed25519') throw new Error('Invalid operator key');
  return result;
}
function keys(config: OperatorKeySet): { social: KeyObject; directory: KeyObject } {
  const social = publicKey(config.socialPublicKey), directory = publicKey(config.directoryPublicKey);
  if (typeof config.socialKeyId !== 'string' || typeof config.directoryKeyId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(config.socialKeyId) || !/^[A-Za-z0-9._-]{1,128}$/.test(config.directoryKeyId) || config.socialKeyId === config.directoryKeyId || social.export({ type: 'spki', format: 'der' }).equals(directory.export({ type: 'spki', format: 'der' }))) throw new Error('Invalid or reused operator key');
  return { social, directory };
}
function payload(purpose: Purpose, identity: RecoveryIdentity, prerequisite: Prerequisite, config: OperatorKeySet): Omit<OperatorAttestation, 'signature'> {
  if (purpose !== 'social-prepared' && purpose !== 'directory-enabled') throw new Error('Invalid attestation purpose');
  if (!identity || !identityFields.slice(0, 4).every(k => typeof identity[k] === 'string' && uuid.test(identity[k])) || !identityFields.slice(4).every(k => typeof identity[k] === 'string' && /^[1-9][0-9]*$/.test(identity[k]) && BigInt(identity[k]) <= 9223372036854775807n)) throw new Error('Invalid attestation identity');
  if (!prerequisite || prerequisite.version !== (purpose === 'social-prepared' ? 'social-traversal-v2' : 'social-prepared-v1') || !/^[0-9a-f]{64}$/.test(prerequisite.digest)) throw new Error('Invalid attestation prerequisite');
  const social = purpose === 'social-prepared';
  return { protocolVersion, purpose, issuer: social ? 'social' : 'directory', audience: social ? 'directory' : 'social', keyId: social ? config.socialKeyId : config.directoryKeyId, ...Object.fromEntries(identityFields.map(k => [k, identity[k]])) as RecoveryIdentity, version: prerequisite.version, digest: prerequisite.digest };
}
function canonical(value: Omit<OperatorAttestation, 'signature'>): Buffer {
  return Buffer.from(fields.map(k => `${Buffer.byteLength(value[k], 'utf8')}:${value[k]}`).join(''), 'utf8');
}
export function signOperatorAttestation(purpose: Purpose, identity: RecoveryIdentity, prerequisite: Prerequisite, privateKey: Key, config: OperatorKeySet): OperatorAttestation {
  const configured = keys(config), value = payload(purpose, identity, prerequisite, config);
  const key = privateKey instanceof KeyObject ? privateKey : createPrivateKey(privateKey);
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519' || !createPublicKey(key).export({ type: 'spki', format: 'der' }).equals(configured[purpose === 'social-prepared' ? 'social' : 'directory'].export({ type: 'spki', format: 'der' }))) throw new Error('Invalid operator signing key');
  return { ...value, signature: sign(null, canonical(value), key).toString('base64url') };
}
export function verifyOperatorAttestation(attestation: OperatorAttestation, purpose: Purpose, identity: RecoveryIdentity, prerequisite: Prerequisite, config: OperatorKeySet): void {
  const configured = keys(config), expected = payload(purpose, identity, prerequisite, config);
  if (!attestation || Object.keys(attestation).length !== fields.length + 1 || fields.some(k => attestation[k] !== expected[k]) || typeof attestation.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(attestation.signature) || Buffer.from(attestation.signature, 'base64url').toString('base64url') !== attestation.signature || !verify(null, canonical(expected), configured[purpose === 'social-prepared' ? 'social' : 'directory'], Buffer.from(attestation.signature, 'base64url'))) throw new Error('Invalid operator attestation');
}
/** Digest of the exact validated signed envelope, for the next durable prerequisite. */
export function operatorAttestationDigest(attestation: OperatorAttestation): string {
  return createHash('sha256').update(canonical(attestation)).update(attestation.signature, 'utf8').digest('hex');
}
