import { randomUUID } from 'node:crypto';
import { bindDirectoryEpochPair, rotateSourceEpoch } from './community-directory-epoch';

describe('incomplete directory recovery', () => {
  it('keeps Social fenced when rotating the source epoch', async () => {
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ fenced: true, phase: 'fenced' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const db = { transaction: async (f: any) => f({ query }) } as any;
    await rotateSourceEpoch(db);
    expect(query.mock.calls[2][0]).not.toMatch(/fenced\s*=\s*false/i);
  });

  it('does not bind an arbitrary operator-supplied pair without durable recovery proof', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const db = { transaction: async (f: any) => f({ query }) } as any;
    await expect(bindDirectoryEpochPair(db, { sourceEpoch: randomUUID(), recoveryEpoch: randomUUID(), owner: randomUUID() }, null as any, 'test-proof-secret-with-at-least-32-bytes')).rejects.toThrow('recovery proof');
    expect(query).not.toHaveBeenCalled();
  });
});
