import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { isActiveSocialAuthority } from './social-authority';
import {
  RecoveryIdentity,
  RecoveryProof,
  verifyRecoveryProof,
} from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

/** Explicit operator-only operations. Callers must externally fence all restored processes first. */
export async function initializeSourceEpoch(db: DataSource): Promise<void> {
  await db.transaction(async (manager) => {
    // Also serializes two initializers when the singleton does not yet exist.
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('community-directory-epoch-init-v1', 0))"
    );
    const rows = await manager.query(
      'SELECT id FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    if (rows.length) throw new Error('Source epoch already initialized');
    await manager.query(
      'INSERT INTO community_directory_epoch (id, "sourceEpoch", fenced, "initializedAt", "updatedAt") VALUES (1, $1, true, now(), now())',
      [randomUUID()]
    );
  });
}

export type SocialRecoveryIdentity = RecoveryIdentity & {
  activationId: string;
  socialGeneration: string;
  directoryGeneration: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = /^[1-9][0-9]*$/;
function validateIdentity(identity: SocialRecoveryIdentity): void {
  if (
    !identity ||
    ![
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
    ].every((v) => typeof v === 'string' && uuid.test(v)) ||
    ![identity.socialGeneration, identity.directoryGeneration].every(
      (v) =>
        typeof v === 'string' &&
        generation.test(v) &&
        BigInt(v) <= BigInt('9223372036854775807')
    )
  )
    throw new Error('Invalid Social recovery identity');
}
function matches(row: any, identity: SocialRecoveryIdentity): boolean {
  return (
    row.sourceEpoch === identity.sourceEpoch &&
    row.directoryRecoveryEpoch === identity.recoveryEpoch &&
    row.owner === identity.owner &&
    row.activationId === identity.activationId &&
    row.socialGeneration === identity.socialGeneration &&
    row.directoryGeneration === identity.directoryGeneration
  );
}

/** The external all-writer fence must be in place before every recovery or refence. */
export async function beginRecovery(db: DataSource): Promise<void> {
  await db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('community-directory-epoch-init-v1', 0))"
    );
    const rows = await manager.query(
      'SELECT * FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    const row = rows[0];
    if (
      row &&
      !(
        (row.fenced === true && ['fenced', 'prepared'].includes(row.phase)) ||
        isActiveSocialAuthority(row) ||
        (row.fenced === false && row.phase === 'capture-only')
      )
    )
      throw new Error('Invalid Social authority phase');
    const source = randomUUID(),
      activation = randomUUID();
    if (row) {
      await manager.query(
        `UPDATE community_directory_epoch SET fenced = true, phase = 'fenced', "sourceEpoch" = $1, "activationId" = $2, "socialGeneration" = "socialGeneration" + 1, "directoryRecoveryEpoch" = NULL, owner = NULL, "directoryGeneration" = NULL, "preparedPayload" = NULL, "registerBaselineEpoch" = NULL, "updatedAt" = now() WHERE id = 1`,
        [source, activation]
      );
    } else {
      await manager.query(
        `INSERT INTO community_directory_epoch (id, "sourceEpoch", "activationId", "socialGeneration", fenced, phase, "initializedAt", "updatedAt") VALUES (1, $1, $2, 1, true, 'fenced', now(), now())`,
        [source, activation]
      );
    }
  });
}

/** Operator asserts the external fence while granting capture-only writes. */
export async function enableRegisterCapture(
  db: DataSource,
  externalFenceConfirmed: boolean
): Promise<void> {
  if (externalFenceConfirmed !== true)
    throw new Error('An external fence is required');
  await db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('community-directory-epoch-init-v1', 0))"
    );
    const [row] = await manager.query(
      'SELECT * FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    if (
      !row ||
      row.fenced !== true ||
      row.phase !== 'fenced' ||
      typeof row.sourceEpoch !== 'string' ||
      !uuid.test(row.sourceEpoch) ||
      typeof row.activationId !== 'string' ||
      !uuid.test(row.activationId) ||
      typeof row.socialGeneration !== 'string' ||
      !generation.test(row.socialGeneration) ||
      BigInt(row.socialGeneration) > 9223372036854775807n ||
      row.registerBaselineEpoch !== row.sourceEpoch ||
      row.directoryRecoveryEpoch !== null ||
      row.owner !== null ||
      row.directoryGeneration !== null ||
      row.preparedPayload !== null
    ) {
      throw new Error('Initialized unbound Social authority required');
    }
    await manager.query(
      `UPDATE community_directory_epoch SET fenced = false, phase = 'capture-only', "updatedAt" = now() WHERE id = 1`
    );
  });
}

export const fenceSourceEpoch = beginRecovery;
export const rotateSourceEpoch = beginRecovery;

/** Bind the operator-observed Directory authority while all processes remain externally fenced. */
export async function bindSocialAuthority(
  db: DataSource,
  identity: SocialRecoveryIdentity,
  proof: RecoveryProof,
  secret: string
): Promise<void> {
  validateIdentity(identity);
  verifyRecoveryProof(identity, proof, secret);
  await db.transaction(async (manager) => {
    const [row] = await manager.query(
      'SELECT * FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    if (
      !row ||
      row.fenced !== true ||
      row.phase !== 'fenced' ||
      row.sourceEpoch !== identity.sourceEpoch ||
      row.activationId !== identity.activationId ||
      row.socialGeneration !== identity.socialGeneration
    )
      throw new Error('Social recovery incarnation does not match');
    if (
      row.directoryRecoveryEpoch !== null ||
      row.owner !== null ||
      row.directoryGeneration !== null
    ) {
      if (!matches(row, identity))
        throw new Error('Social recovery identity already bound');
      return;
    }
    await manager.query(
      'UPDATE community_directory_epoch SET "directoryRecoveryEpoch" = $1, owner = $2, "directoryGeneration" = $3, "updatedAt" = now() WHERE id = 1',
      [identity.recoveryEpoch, identity.owner, identity.directoryGeneration]
    );
  });
}

export type SocialPreparedPayload = {
  version: 'social-traversal-v2';
  digest: string;
  retirementCount: string;
  retirementDigest: string;
};
const sha256 = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Call only while all external writers remain fenced. */
export async function prepareSocialAuthority(
  db: DataSource,
  identity: SocialRecoveryIdentity,
  proof: RecoveryProof,
  secret: string
): Promise<SocialPreparedPayload> {
  validateIdentity(identity);
  verifyRecoveryProof(identity, proof, secret);
  // The ordered array is the versioned canonical traversal input, including its authenticated proof.
  const digest = sha256([
    'social-traversal-v2',
    identity.sourceEpoch,
    identity.recoveryEpoch,
    identity.owner,
    identity.activationId,
    identity.socialGeneration,
    identity.directoryGeneration,
    proof.traversal,
    proof.signature,
  ]);
  return db.transaction(async (manager) => {
    const [row] = await manager.query(
      'SELECT * FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    if (!row || row.fenced !== true || !matches(row, identity))
      throw new Error('Social recovery identity does not match');
    if (row.phase === 'prepared') {
      const p = row.preparedPayload;
      if (
        !p ||
        Object.keys(p).sort().join(',') !==
          'digest,retirementCount,retirementDigest,version' ||
        p.version !== 'social-traversal-v2' ||
        p.digest !== digest ||
        typeof p.retirementCount !== 'string' ||
        !/^(0|[1-9][0-9]*)$/.test(p.retirementCount) ||
        typeof p.retirementDigest !== 'string' ||
        !/^[0-9a-f]{64}$/.test(p.retirementDigest)
      )
        throw new Error('Prepared Social payload does not match');
      return p as SocialPreparedPayload;
    }
    if (row.phase !== 'fenced' || row.preparedPayload !== null)
      throw new Error('Invalid Social authority phase');
    const [retired] = await manager.query(
      'DELETE FROM community_directory_change RETURNING revision, "communityId", operation, "sourceEpoch", "eventNonce"'
    );
    retired.sort((a: any, b: any) =>
      BigInt(a.revision) < BigInt(b.revision)
        ? -1
        : BigInt(a.revision) > BigInt(b.revision)
        ? 1
        : 0
    );
    const payload: SocialPreparedPayload = {
      version: 'social-traversal-v2',
      digest,
      retirementCount: String(retired.length),
      retirementDigest: sha256([
        'social-retirement-v1',
        ...retired.map((r: any) => [
          r.revision,
          r.communityId,
          r.operation,
          r.sourceEpoch,
          r.eventNonce,
        ]),
      ]),
    };
    await manager.query(
      `UPDATE community_directory_epoch SET phase = 'prepared', "preparedPayload" = $1::jsonb, "updatedAt" = now() WHERE id = 1`,
      [JSON.stringify(payload)]
    );
    return payload;
  });
}

/** Three-field binding cannot establish six-field authority. */
export async function bindDirectoryEpochPair(
  _db: DataSource,
  _identity: Pick<RecoveryIdentity, 'sourceEpoch' | 'recoveryEpoch' | 'owner'>,
  _proof: RecoveryProof,
  _secret: string
): Promise<void> {
  throw new Error(
    'Legacy Social binding is disabled: recovery proof cannot establish authority'
  );
}

/** Legacy three-field proofs cannot authorize the new authority transition. */
export async function activateSourceEpoch(
  _db: DataSource,
  _identity: Pick<RecoveryIdentity, 'sourceEpoch' | 'recoveryEpoch' | 'owner'>,
  _proof: RecoveryProof,
  _secret: string
): Promise<number> {
  throw new Error(
    'Legacy Social activation is disabled until the authority transition is implemented'
  );
}
