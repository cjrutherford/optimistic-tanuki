import { randomUUID } from 'node:crypto';
import { ClassifiedCommands as C } from '@optimistic-tanuki/constants';
import loadDatabase from '../../../classifieds/src/app/loadDatabase';
import { ClassifiedsAccountDeletionOwnerService } from '../../../classifieds/src/app/account-deletion-owner.service';
import { ClassifiedsAccountDeletionOwnerController } from '../../../classifieds/src/app/account-deletion-owner.controller';
import { DeletionOwnerFixture } from './deletion-owner.fixture';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
(process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture'
  ? describe
  : describe.skip)('D16 real Auth/Classifieds TCP deletion', () => {
  const f = new DeletionOwnerFixture();
  let client: any;
  let own: string, second: string, foreign: string, outside: string;
  const ad = (userId: string, profileId: string, appScope = 'local-hub') => ({
    id: randomUUID(),
    title: 'PRIVATE_LISTING',
    description: 'PRIVATE_DESCRIPTION',
    userId,
    profileId,
    appScope,
    price: '12.30',
    imageUrls: 'opaque-owned-asset-pointer',
  });
  beforeAll(async () => {
    const authority = await f.start(
      'd16_classifieds',
      loadDatabase({ get: () => ({}) } as never)
    );
    client = await f.serve(
      [ClassifiedsAccountDeletionOwnerController],
      [
        {
          provide: ClassifiedsAccountDeletionOwnerService,
          useValue: new ClassifiedsAccountDeletionOwnerService(f.db, authority),
        },
      ]
    );
    own = await f.seed('classified_ad', ad(f.account, f.profile));
    second = await f.seed(
      'classified_ad',
      ad(f.account, f.profile2, 'client-interface')
    );
    foreign = await f.seed('classified_ad', ad(f.other, f.otherProfile));
    outside = await f.seed(
      'classified_ad',
      ad(f.account, f.profile, 'outside-release')
    );
  }, 30000);
  afterAll(() => f.close(), 30000);
  it('checks binding, drains producers, retries removal and preserves counterpart and out-of-release listings', async () => {
    const before = await f.db.query(
      'SELECT * FROM classified_ad WHERE id=ANY($1::uuid[]) ORDER BY id',
      [[foreign, outside]]
    );
    await expect(
      f.call(
        client,
        C.FENCE_ACCOUNT_DELETION,
        await f.grant('workspace', 'fence')
      )
    ).rejects.toBeTruthy();
    const fence = await f.grant('classifieds', 'fence');
    const conflict = await f.seed(
      'classified_ad',
      ad(f.account, f.otherProfile)
    );
    await expect(
      f.call(client, C.FENCE_ACCOUNT_DELETION, fence)
    ).rejects.toBeTruthy();
    expect(
      await f.db.query('SELECT * FROM account_deletion_write_fence')
    ).toEqual([]);
    await f.db.query('DELETE FROM classified_ad WHERE id=$1', [conflict]);
    const writer = f.db.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    await writer.query('UPDATE classified_ad SET title=title WHERE id=$1', [
      own,
    ]);
    let done = false;
    const pending = f
      .call(client, C.FENCE_ACCOUNT_DELETION, fence)
      .then((r) => {
        done = true;
        return r;
      });
    try {
      await new Promise((r) => setTimeout(r, 120));
      expect(done).toBe(false);
      await writer.commitTransaction();
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
    }
    expect(await pending).toMatchObject({ verified: true });
    await f.authority.acknowledge(fence);
    await expect(
      f.db.query(
        'UPDATE classified_ad SET "userId"=$2,"profileId"=$3 WHERE id=$1',
        [own, f.other, f.otherProfile]
      )
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      f.db.query(
        'UPDATE classified_ad SET "userId"=$2,"profileId"=$3 WHERE id=$1',
        [foreign, f.account, f.profile]
      )
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await f.allFencePremises();
    const erase = await f.grant('classifieds', 'erase');
    await f.db.query(
      "CREATE FUNCTION d16_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D16_INJECTED';END $$"
    );
    await f.db.query(
      'CREATE TRIGGER d16_fault AFTER DELETE ON classified_ad FOR EACH ROW EXECUTE FUNCTION d16_fault()'
    );
    await expect(
      f.call(client, C.ERASE_ACCOUNT_DELETION, erase)
    ).rejects.toBeTruthy();
    expect(
      (await f.db.query('SELECT id FROM classified_ad WHERE id=$1', [own]))
        .length
    ).toBe(1);
    await f.db.query('DROP TRIGGER d16_fault ON classified_ad');
    await f.db.query('DROP FUNCTION d16_fault()');
    for (let i = 0; i < 2; i++)
      expect(await f.call(client, C.ERASE_ACCOUNT_DELETION, erase)).toEqual({
        verified: true,
        remaining: 0,
      });
    await f.authority.acknowledge(erase);
    expect(
      await f.call(
        client,
        C.READBACK_ACCOUNT_DELETION,
        await f.grant('classifieds', 'readback')
      )
    ).toEqual({ verified: true, remaining: 0 });
    expect(
      await f.db.query(
        'SELECT id FROM classified_ad WHERE id=ANY($1::uuid[])',
        [[own, second]]
      )
    ).toEqual([]);
    expect(
      await f.db.query(
        'SELECT * FROM classified_ad WHERE id=ANY($1::uuid[]) ORDER BY id',
        [[foreign, outside]]
      )
    ).toEqual(before);
    await expect(
      f.seed('classified_ad', ad(f.account, f.profile))
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await f.db.query('UPDATE classified_ad SET title=$2 WHERE id=$1', [
      foreign,
      'COUNTERPART_UPDATED',
    ]);
  }, 30000);
});
