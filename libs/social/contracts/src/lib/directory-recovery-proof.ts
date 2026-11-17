import { createHmac, timingSafeEqual } from 'node:crypto';

export type RecoveryIdentity = {
  sourceEpoch: string;
  recoveryEpoch: string;
  owner: string;
  activationId: string;
  socialGeneration: string;
  directoryGeneration: string;
};
export type RecoveryProof = RecoveryIdentity & {
  traversal: 'social-then-directory-v2';
  signature: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const traversal = 'social-then-directory-v2' as const;

function canonical(identity: RecoveryIdentity): string {
  if (
    !identity ||
    ![
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
    ].every((x) => typeof x === 'string' && uuid.test(x)) ||
    ![identity.socialGeneration, identity.directoryGeneration].every(
      (x) =>
        typeof x === 'string' &&
        /^[1-9][0-9]*$/.test(x) &&
        BigInt(x) <= 9223372036854775807n
    )
  )
    throw new Error('Invalid recovery proof identity');
  return (
    'directory-recovery-proof-v2:' +
    [
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
      identity.socialGeneration,
      identity.directoryGeneration,
      traversal,
    ]
      .map((x) => `${Buffer.byteLength(x, 'utf8')}:${x}`)
      .join('')
  );
}
export function validateRecoveryProofSecret(secret: string): void {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    [
      'DIRECTORY_SOCIAL_SECRET',
      'DIRECTORY_SERVICE_SECRET',
      'DIRECTORY_RECEIPT_SIGNING_SECRET',
      'DIRECTORY_RECOVERY_READ_SECRET',
      'DIRECTORY_ELIGIBILITY_SECRET',
    ].some((key) => process.env[key] && process.env[key] === secret)
  )
    throw new Error('Invalid or reused recovery proof secret');
}
export function signRecoveryProof(
  identity: RecoveryIdentity,
  secret: string
): RecoveryProof {
  validateRecoveryProofSecret(secret);
  const signature = createHmac('sha256', secret)
    .update(canonical(identity))
    .digest('hex');
  return { ...identity, traversal, signature };
}
export function verifyRecoveryProof(
  identity: RecoveryIdentity,
  proof: RecoveryProof,
  secret: string
): void {
  const expected = signRecoveryProof(identity, secret);
  if (
    !proof ||
    proof.sourceEpoch !== identity.sourceEpoch ||
    proof.recoveryEpoch !== identity.recoveryEpoch ||
    proof.owner !== identity.owner ||
    proof.activationId !== identity.activationId ||
    proof.socialGeneration !== identity.socialGeneration ||
    proof.directoryGeneration !== identity.directoryGeneration ||
    proof.traversal !== traversal ||
    typeof proof.signature !== 'string' ||
    !/^[0-9a-f]{64}$/.test(proof.signature) ||
    !timingSafeEqual(
      Buffer.from(expected.signature, 'hex'),
      Buffer.from(proof.signature, 'hex')
    )
  )
    throw new Error('Invalid recovery proof');
}
