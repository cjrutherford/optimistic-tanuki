import { randomUUID } from 'node:crypto';
import {
  beginRecovery,
  prepareSocialAuthority,
} from './community-directory-epoch';

const secret = 'disposable-secret-at-least-thirty-two-bytes';
it('rejects incomplete authority before any database mutation', async () => {
  const db = { transaction: jest.fn() } as any;
  const identity = {
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
    owner: randomUUID(),
  };
  await expect(
    prepareSocialAuthority(db, identity as any, {} as any, secret)
  ).rejects.toThrow();
  expect(db.transaction).not.toHaveBeenCalled();
});
it('begins recovery under a transaction', async () => {
  const query = jest
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 1, fenced: true, phase: 'fenced' }])
    .mockResolvedValue([]);
  await beginRecovery({ transaction: (fn: any) => fn({ query }) } as any);
  expect(query.mock.calls[2][0]).toContain('socialGeneration');
  expect(query.mock.calls[2][0]).toContain('activationId');
});
