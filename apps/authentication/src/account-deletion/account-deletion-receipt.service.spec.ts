import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccountDeletionReceiptService } from './account-deletion-receipt.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const ACCOUNT = randomUUID(),
  OP = randomUUID(),
  KEY = randomUUID();
const config = (secret = 'receipt-unit-secret-at-least-32-characters') =>
  new ConfigService({ auth: { jwt_secret: secret } });
describe('U02 deletion receipt capability', () => {
  it('binds an opaque preparation to app, future operation and account hash without raw account identity', () => {
    const service = new AccountDeletionReceiptService(config());
    const token = service.issue(ACCOUNT, 'local-hub', OP, KEY);
    const value = service.verify(token, 'local-hub');
    expect(value.operationId).toBe(OP);
    expect(value.requestId).toBe(KEY);
    expect(
      Buffer.from(token.split('.')[0], 'base64url').toString()
    ).not.toContain(ACCOUNT);
    expect(service.matchesAccount(value, ACCOUNT)).toBe(true);
    expect(service.matchesAccount(value, randomUUID())).toBe(false);
    expect(
      new AccountDeletionReceiptService(config()).verify(token, 'local-hub')
    ).toEqual(value);
  });
  it('rejects cross-app, rotated-key, malformed and tampered receipts', () => {
    const service = new AccountDeletionReceiptService(config());
    const token = service.issue(ACCOUNT, 'local-hub', OP, KEY);
    for (const invalid of [
      '',
      token + 'x',
      token.replace(/.$/, token.endsWith('a') ? 'b' : 'a'),
      'x'.repeat(3000),
      {},
      null,
    ])
      expect(() => service.verify(invalid, 'local-hub')).toThrow(
        'DELETION_RECEIPT_INVALID'
      );
    expect(() => service.verify(token, 'client-interface')).toThrow(
      'DELETION_RECEIPT_INVALID'
    );
    expect(() =>
      new AccountDeletionReceiptService(
        config('different-strong-receipt-signing-secret')
      ).verify(token, 'local-hub')
    ).toThrow('DELETION_RECEIPT_INVALID');
  });
  it('expires receipt access without cancelling an already accepted operation', () => {
    const service = new AccountDeletionReceiptService(config()),
      token = service.issue(ACCOUNT, 'local-hub', OP, KEY),
      now = Date.now();
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(now + 7 * 86400000 + 1);
    try {
      expect(() => service.verify(token, 'local-hub')).toThrow(
        'DELETION_RECEIPT_INVALID'
      );
    } finally {
      clock.mockRestore();
    }
  });
  it('requires a configured strong key and canonical identities', () => {
    expect(
      () => new AccountDeletionReceiptService(config('default_jwt_secret'))
    ).toThrow('DELETION_RECEIPT_SECRET_REQUIRED');
    const service = new AccountDeletionReceiptService(config());
    expect(() =>
      service.issue('not-an-account', 'local-hub', OP, KEY)
    ).toThrow();
  });
});
