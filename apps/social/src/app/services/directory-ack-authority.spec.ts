import { randomUUID } from 'node:crypto';
import { bindDirectoryEpochPair } from './community-directory-epoch';

it('rejects operator-supplied authority without durable recovery proof', async () => {
  const query = jest.fn();
  const db = { transaction: async (f: any) => f({ query }) } as any;
  await expect(
    bindDirectoryEpochPair(
      db,
      {
        sourceEpoch: randomUUID(),
        recoveryEpoch: randomUUID(),
        owner: randomUUID(),
      },
      null as any,
      'test-proof-secret-with-at-least-32-bytes'
    )
  ).rejects.toThrow('recovery proof');
  expect(query).not.toHaveBeenCalled();
});
