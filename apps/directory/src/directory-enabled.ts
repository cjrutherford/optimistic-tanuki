import { createHash } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { RecoveryIdentity } from '../../../libs/social/contracts/src/lib/directory-recovery-proof';
import {
  OperatorAttestation,
  OperatorKeySet,
  operatorAttestationDigest,
  verifyOperatorAttestation,
} from '../../../libs/social/contracts/src/lib/directory-operator-attestation';

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = [
  'sourceEpoch',
  'recoveryEpoch',
  'owner',
  'activationId',
  'socialGeneration',
  'directoryGeneration',
] as const;
const hex = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const count = (v: unknown) =>
  typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v);

// Pool acquisition can wait independently of PostgreSQL's lock and statement timers.
async function connectBounded(runner: QueryRunner): Promise<void> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connecting = runner.connect().then(async () => {
    if (expired) await runner.release();
  });
  try {
    await Promise.race([
      connecting,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Database connection deadline exceeded'));
        }, 2000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Operator only. The caller must keep every external writer and serving process fenced. */
export async function enableDirectory(
  social: DataSource,
  directory: DataSource,
  identity: RecoveryIdentity,
  proof: OperatorAttestation,
  keys: OperatorKeySet,
  externalFence: boolean
) {
  if (externalFence !== true)
    throw new Error('External fence confirmation required');
  const s = social.createQueryRunner(),
    d = directory.createQueryRunner();
  let socialTx = false,
    directoryTx = false,
    socialConnected = false,
    directoryConnected = false;
  try {
    // Never wait for a pool connection while holding authority in the other database.
    await connectBounded(d);
    directoryConnected = true;
    await connectBounded(s);
    socialConnected = true;
    await d.startTransaction();
    directoryTx = true;
    await d.query("SET LOCAL lock_timeout = '2s'");
    await d.query("SET LOCAL statement_timeout = '10s'");
    await d.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
    );
    await s.startTransaction();
    socialTx = true;
    await s.query("SET LOCAL lock_timeout = '2s'");
    await s.query("SET LOCAL statement_timeout = '10s'");
    const rows = await s.query(
      'SELECT * FROM community_directory_epoch WHERE id=1 FOR UPDATE'
    );
    const row = rows[0],
      p = row?.preparedPayload;
    if (
      rows.length !== 1 ||
      row.fenced !== true ||
      row.phase !== 'prepared' ||
      !identity ||
      row.sourceEpoch !== identity.sourceEpoch ||
      row.directoryRecoveryEpoch !== identity.recoveryEpoch ||
      row.owner !== identity.owner ||
      row.activationId !== identity.activationId ||
      row.socialGeneration !== identity.socialGeneration ||
      row.directoryGeneration !== identity.directoryGeneration ||
      !p ||
      Object.keys(p).sort().join(',') !==
        'digest,retirementCount,retirementDigest,version' ||
      p.version !== 'social-traversal-v2' ||
      !hex(p.digest) ||
      !count(p.retirementCount) ||
      !hex(p.retirementDigest)
    )
      throw new Error('Invalid Social prepared authority');
    verifyOperatorAttestation(
      proof,
      'social-prepared',
      identity,
      { version: p.version, digest: p.digest },
      keys
    );
    const preparedDigest = operatorAttestationDigest(proof);
    const checkpoints = await d.query(
      `SELECT p.*, i."recoveryEpoch" AS authority FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR UPDATE OF p, i`
    );
    const checkpoint = checkpoints[0];
    if (
      checkpoints.length !== 1 ||
      checkpoint.authority !== identity.recoveryEpoch ||
      fields.some((k) => checkpoint[k] !== identity[k]) ||
      checkpoint.cursor !== null
    )
      throw new Error('Directory recovery identity mismatch');
    let result = checkpoint.enabledPayload;
    if (checkpoint.phase === 'enabled') {
      if (
        !result ||
        Object.keys(result).sort().join(',') !==
          'preparedDigest,retirementCount,retirementDigest,version' ||
        result.version !== 'directory-enabled-v1' ||
        result.preparedDigest !== preparedDigest ||
        !count(result.retirementCount) ||
        !hex(result.retirementDigest)
      )
        throw new Error('Directory enabled result mismatch');
    } else {
      if (checkpoint.phase !== 'traversed' || result !== null)
        throw new Error('Directory checkpoint is not traversed');
      await d.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('directory-receipt-pool-v1', 0))"
      );
      const [retired] = await d.query(
        'DELETE FROM directory_reconciliation_receipt RETURNING "eventId", "communityId", "slotId", "eventNonce", "sourceEpoch", "recoveryEpoch"'
      );
      retired.sort((a: any, b: any) =>
        BigInt(a.eventId) < BigInt(b.eventId)
          ? -1
          : BigInt(a.eventId) > BigInt(b.eventId)
          ? 1
          : 0
      );
      result = {
        version: 'directory-enabled-v1',
        preparedDigest,
        retirementCount: String(retired.length),
        retirementDigest: hash([
          'directory-retirement-v1',
          ...retired.map((r: any) => [
            r.eventId,
            r.communityId,
            r.slotId,
            r.eventNonce,
            r.sourceEpoch,
            r.recoveryEpoch,
          ]),
        ]),
      };
      await d.query(
        `UPDATE directory_census_progress SET phase='enabled', "enabledPayload"=$1::jsonb, "updatedAt"=now() WHERE id='recovery'`,
        [JSON.stringify(result)]
      );
    }
    await d.commitTransaction();
    directoryTx = false;
    await s.commitTransaction();
    socialTx = false;
    return result as {
      version: string;
      preparedDigest: string;
      retirementCount: string;
      retirementDigest: string;
    };
  } finally {
    try {
      if (directoryTx) await d.rollbackTransaction();
    } finally {
      try {
        if (socialTx) await s.rollbackTransaction();
      } finally {
        try {
          if (directoryConnected) await d.release();
        } finally {
          if (socialConnected) await s.release();
        }
      }
    }
  }
}
