import { createHmac } from 'node:crypto';

/** Candidate v2 encoding. It is deliberately not connected to the fenced ACK path. */
export interface ReceiptV2Identity {
  revision: string;
  communityId: string;
  eventNonce: string;
  sourceEpoch: string;
  recoveryEpoch: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Domain followed by five ASCII fields, each prefixed by its decimal byte length and colon. */
export function canonicalReceiptV2(identity: ReceiptV2Identity): string {
  if (
    !identity ||
    typeof identity.revision !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(identity.revision) ||
    BigInt(identity.revision) > 9223372036854775807n ||
    ![
      identity.communityId,
      identity.eventNonce,
      identity.sourceEpoch,
      identity.recoveryEpoch,
    ].every((value) => typeof value === 'string' && uuid.test(value))
  )
    throw new Error('Invalid v2 receipt identity');
  const fields = [
    identity.revision,
    identity.communityId,
    identity.eventNonce,
    identity.sourceEpoch,
    identity.recoveryEpoch,
  ];
  return (
    'directory-receipt-v2:' +
    fields
      .map((value) => `${Buffer.byteLength(value, 'utf8')}:${value}`)
      .join('')
  );
}

export function signReceiptV2(
  secret: string,
  identity: ReceiptV2Identity
): string {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32)
    throw new Error('Invalid receipt signing secret');
  return createHmac('sha256', secret)
    .update(canonicalReceiptV2(identity), 'utf8')
    .digest('hex');
}
