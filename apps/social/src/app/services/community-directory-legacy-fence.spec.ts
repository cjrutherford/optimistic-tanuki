import { activateSourceEpoch } from './community-directory-epoch';
import { DataSource } from 'typeorm';

describe('legacy Social activation', () => {
  it('fails closed without touching the database, even with a legacy proof', async () => {
    const db = { transaction: jest.fn() } as unknown as DataSource;
    await expect(
      activateSourceEpoch(
        db,
        { sourceEpoch: 'source', recoveryEpoch: 'recovery', owner: 'owner' },
        { signature: 'proof' } as never,
        'secret'
      )
    ).rejects.toThrow('Legacy Social activation is disabled');
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
