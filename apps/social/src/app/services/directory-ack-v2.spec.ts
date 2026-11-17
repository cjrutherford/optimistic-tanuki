import { createHmac } from 'node:crypto';
import { verifyDirectoryAckV2 } from './directory-ack-v2';

const identity = { revision: '12', communityId: '12345678-1234-1234-1234-123456789abc', eventNonce: '22345678-1234-1234-1234-123456789abc', sourceEpoch: '32345678-1234-1234-1234-123456789abc', recoveryEpoch: '42345678-1234-1234-1234-123456789abc' };
const signing = 'a'.repeat(32), transport = 'b'.repeat(32);
const canonical = (v: typeof identity) => 'directory-receipt-v2:' + Object.values(v).map(s => `${Buffer.byteLength(s)}:${s}`).join('');
const sign = (v: typeof identity) => createHmac('sha256', signing).update(canonical(v)).digest('hex');
const check = (v: any, signature: any = sign(identity), source = identity.sourceEpoch, recovery = identity.recoveryEpoch, key = signing, auth = transport) => verifyDirectoryAckV2(v, signature, { sourceEpoch: source, recoveryEpoch: recovery }, key, auth);

describe('v2 directory ACK verification', () => {
  it('accepts only the signed canonical identity and current authority epochs', () => {
    expect(check(identity)).toEqual(identity);
    for (const field of ['communityId', 'eventNonce', 'sourceEpoch', 'recoveryEpoch'] as const) {
      expect(() => check({ ...identity, [field]: '52345678-1234-1234-1234-123456789abc' })).toThrow();
    }
    expect(() => check(identity, '0'.repeat(64))).toThrow();
    expect(() => check(identity, sign(identity), '52345678-1234-1234-1234-123456789abc')).toThrow();
    expect(() => check(identity, sign(identity), identity.sourceEpoch, '52345678-1234-1234-1234-123456789abc')).toThrow();
    expect(() => check(identity, sign(identity), identity.sourceEpoch, identity.recoveryEpoch, signing, signing)).toThrow();
  });
  it('rejects malformed and legacy inputs', () => {
    for (const value of [null, {}, { ...identity, eventNonce: null }, { ...identity, revision: '01' }, { ...identity, revision: '9223372036854775808' }, { ...identity, communityId: identity.communityId.toUpperCase() }]) expect(() => check(value)).toThrow();
    for (const signature of [null, '', 'a'.repeat(63), 'A'.repeat(64)]) expect(() => check(identity, signature)).toThrow();
  });
});
