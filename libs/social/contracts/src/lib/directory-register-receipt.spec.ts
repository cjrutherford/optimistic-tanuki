import { createHmac } from 'node:crypto';
import {
  DirectoryRegisterReceipt,
  verifyDirectoryRegisterReceipt,
} from './directory-register-receipt';

const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const expected = {
  sourceEpoch: id(1),
  recoveryEpoch: id(2),
  owner: id(3),
  activationId: id(4),
  socialGeneration: '5',
  directoryGeneration: '6',
  communityId: id(7),
  changeToken: id(8),
};
const secret = 'a'.repeat(32);
function signed(): DirectoryRegisterReceipt {
  const version = 'directory-register-receipt-v1' as const;
  const parts = [
    version,
    expected.sourceEpoch,
    expected.recoveryEpoch,
    expected.owner,
    expected.activationId,
    expected.socialGeneration,
    expected.directoryGeneration,
    expected.communityId,
    expected.changeToken,
  ];
  const message =
    'directory-register-receipt:' +
    parts.map((v) => `${Buffer.byteLength(v)}:${v}`).join('');
  return {
    ...expected,
    version,
    signature: createHmac('sha256', secret).update(message).digest('hex'),
  };
}
describe('register receipt authentication', () => {
  it('accepts a matching authenticated assertion', () =>
    expect(() =>
      verifyDirectoryRegisterReceipt(signed(), expected, secret)
    ).not.toThrow());
  it.each(Object.keys(expected))('rejects swapped or stale %s', (field) => {
    const receipt = {
      ...signed(),
      [field]: field.endsWith('Generation') ? '9' : id(9),
    };
    expect(() =>
      verifyDirectoryRegisterReceipt(receipt, expected, secret)
    ).toThrow('Invalid directory register receipt');
  });
  it('rejects a forged signature, wrong key, malformed signature, and extra fields', () => {
    for (const receipt of [
      { ...signed(), signature: '0'.repeat(64) },
      { ...signed(), signature: 'x' },
      { ...signed(), extra: 'x' },
    ]) {
      expect(() =>
        verifyDirectoryRegisterReceipt(receipt, expected, secret)
      ).toThrow();
    }
    expect(() =>
      verifyDirectoryRegisterReceipt(signed(), expected, 'b'.repeat(32))
    ).toThrow();
  });
  it('does not disclose the key in errors', () => {
    try {
      verifyDirectoryRegisterReceipt(signed(), expected, 'short');
    } catch (error) {
      expect(String(error)).not.toContain('short');
    }
  });
  it('rejects invalid generations even when the expected identity agrees', () => {
    for (const value of ['0', '01', '9223372036854775808']) {
      expect(() =>
        verifyDirectoryRegisterReceipt(
          { ...signed(), socialGeneration: value },
          { ...expected, socialGeneration: value },
          secret
        )
      ).toThrow();
    }
  });
});
