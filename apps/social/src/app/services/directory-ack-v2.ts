import { lockSocialRuntimeAuthority, trustedDirectoryRuntimeEpochs } from './social-authority';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EntityManager } from 'typeorm';

export interface DirectoryAckV2Identity {
  revision: string;
  communityId: string;
  eventNonce: string;
  sourceEpoch: string;
  recoveryEpoch: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The epochs must come from trusted authorities, never from the ACK itself. */
export function verifyDirectoryAckV2(value: unknown, signature: unknown, authority: { sourceEpoch: string; recoveryEpoch: string }, signingSecret: string, transportSecret: string): DirectoryAckV2Identity {
  const fail = (): never => { throw new Error('Invalid directory acknowledgement'); };
  if (!value || typeof value !== 'object' || !authority || typeof signingSecret !== 'string' || Buffer.byteLength(signingSecret) < 32 || typeof transportSecret !== 'string' || Buffer.byteLength(transportSecret) < 32 || signingSecret === transportSecret) return fail();
  const v = value as DirectoryAckV2Identity;
  if (typeof v.revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(v.revision) || BigInt(v.revision) > 9223372036854775807n ||
      ![v.communityId, v.eventNonce, v.sourceEpoch, v.recoveryEpoch, authority.sourceEpoch, authority.recoveryEpoch].every(x => typeof x === 'string' && uuid.test(x)) ||
      v.sourceEpoch !== authority.sourceEpoch || v.recoveryEpoch !== authority.recoveryEpoch || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return fail();
  const fields = [v.revision, v.communityId, v.eventNonce, v.sourceEpoch, v.recoveryEpoch];
  const canonical = 'directory-receipt-v2:' + fields.map(x => `${Buffer.byteLength(x, 'utf8')}:${x}`).join('');
  const expected = createHmac('sha256', signingSecret).update(canonical, 'utf8').digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return fail();
  return { revision: v.revision, communityId: v.communityId, eventNonce: v.eventNonce, sourceEpoch: v.sourceEpoch, recoveryEpoch: v.recoveryEpoch };
}

/** Caller must hold the source epoch lock and establish a race-safe trusted recovery authority.
 * This primitive is deliberately not connected to the fenced RPC. */
export async function deleteExactDirectoryAckV2(manager: EntityManager, identity: DirectoryAckV2Identity): Promise<'deleted' | 'already-absent'> {
  const rows = await manager.query('SELECT "communityId", "eventNonce", "sourceEpoch" FROM community_directory_change WHERE revision = $1 FOR UPDATE', [identity.revision]);
  if (!rows.length) return 'already-absent';
  const row = rows[0];
  if (rows.length !== 1 || row.communityId !== identity.communityId || row.eventNonce !== identity.eventNonce || row.sourceEpoch !== identity.sourceEpoch) throw new Error('Directory acknowledgement identity collision');
  const deleted = await manager.query('WITH deleted AS (DELETE FROM community_directory_change WHERE revision = $1 AND "communityId" = $2 AND "eventNonce" = $3 AND "sourceEpoch" = $4 RETURNING revision) SELECT revision FROM deleted', [identity.revision, identity.communityId, identity.eventNonce, identity.sourceEpoch]);
  if (deleted.length !== 1) throw new Error('Directory acknowledgement deletion failed');
  return 'deleted';
}

/** Transaction-scoped primitive; the RPC remains disabled until recovery is complete. */
export async function acknowledgeDirectoryV2(manager: EntityManager, value: unknown, signature: unknown, signingSecret: string, transportSecret: string): Promise<'deleted' | 'already-absent'> {
  const authority = await lockSocialRuntimeAuthority(manager, trustedDirectoryRuntimeEpochs());
  const identity = verifyDirectoryAckV2(value, signature, { sourceEpoch: authority.sourceEpoch, recoveryEpoch: authority.directoryRecoveryEpoch }, signingSecret, transportSecret);
  return deleteExactDirectoryAckV2(manager, identity);
}
