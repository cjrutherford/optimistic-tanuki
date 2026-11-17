import { EntityManager } from 'typeorm';

/** An upgraded legacy row is never evidence of an active v2 authority. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = /^[1-9][0-9]*$/;
export const SOCIAL_AUTHORITY_COLUMNS =
  '"sourceEpoch", "directoryRecoveryEpoch", fenced, phase, "activationId", owner, "socialGeneration", "directoryGeneration"';
export function isActiveSocialAuthority(row: any): boolean {
  return (
    !!row &&
    row.fenced === false &&
    row.phase === 'active' &&
    [
      row.sourceEpoch,
      row.directoryRecoveryEpoch,
      row.activationId,
      row.owner,
    ].every((value) => typeof value === 'string' && uuid.test(value)) &&
    [row.socialGeneration, row.directoryGeneration].every(
      (value) => typeof value === 'string' && generation.test(value)
    )
  );
}

export interface SocialExpectedEpochs {
  sourceEpoch: string;
  recoveryEpoch: string;
}

/** Local transaction fence only; it does not establish that Directory is still current. */
export async function lockSocialRuntimeAuthority(
  manager: EntityManager,
  expected: SocialExpectedEpochs | undefined
): Promise<any> {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error('Directory runtime authority unavailable');
  }
  const rows = await manager.query(
    `SELECT ${SOCIAL_AUTHORITY_COLUMNS}, "preparedPayload" FROM community_directory_epoch WHERE id = 1 FOR SHARE`
  );
  const row = rows[0],
    accepted = row?.preparedPayload?.accepted;
  if (
    !expected ||
    ![expected.sourceEpoch, expected.recoveryEpoch].every(
      (v) => typeof v === 'string' && uuid.test(v)
    ) ||
    rows.length !== 1 ||
    !isActiveSocialAuthority(row) ||
    row.sourceEpoch !== expected.sourceEpoch ||
    row.directoryRecoveryEpoch !== expected.recoveryEpoch ||
    !accepted ||
    Object.keys(accepted).sort().join(',') !== 'digest,version' ||
    accepted.version !== 'directory-enabled-v1' ||
    typeof accepted.digest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(accepted.digest)
  ) {
    throw new Error('Directory runtime authority unavailable');
  }
  return row;
}

/** No cross-store runtime proof is available yet. Never derive this from a request or the local row. */
export function trustedDirectoryRuntimeEpochs():
  | SocialExpectedEpochs
  | undefined {
  return undefined;
}
