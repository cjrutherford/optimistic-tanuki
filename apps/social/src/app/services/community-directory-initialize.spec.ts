import { initializeSourceEpoch, enableRegisterCapture } from './community-directory-epoch';
import { DataSource } from 'typeorm';

describe('source authority initialization', () => {
  it('creates a fenced authority until coordinated recovery enables it', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const db = { transaction: async (run: any) => run({ query }) } as DataSource;
    await initializeSourceEpoch(db);
    const insert = query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO community_directory_epoch'));
    expect(insert?.[0]).toMatch(/VALUES \(1, \$1, true,/);
  });
  it('requires a valid source activation and positive generation before capture', async () => {
    const epoch='11111111-1111-4111-8111-111111111111';
    const row:any = {sourceEpoch:epoch, registerBaselineEpoch:epoch, fenced:true, phase:'fenced', directoryRecoveryEpoch:null, owner:null, directoryGeneration:null, preparedPayload:null, activationId:null, socialGeneration:'1'};
    const query = jest.fn(async (sql:string) => sql.startsWith('SELECT *') ? [row] : []);
    const db = {transaction:async (fn:any) => fn({query})} as DataSource;
    await expect(enableRegisterCapture(db,true)).rejects.toThrow('unbound');
    row.activationId=epoch; row.socialGeneration='0';
    await expect(enableRegisterCapture(db,true)).rejects.toThrow('unbound');
  });

});
