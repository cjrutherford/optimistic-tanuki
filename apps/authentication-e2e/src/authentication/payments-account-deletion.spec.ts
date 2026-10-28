import { randomUUID } from 'node:crypto';
import { DELETED_ACCOUNT_ID as nil } from '@optimistic-tanuki/models';
import { PaymentCommands as C } from '@optimistic-tanuki/constants';
import loadDatabase from '../../../payments/src/app/loadDatabase';
import { PaymentsAccountDeletionOwnerService } from '../../../payments/src/app/account-deletion-owner.service';
import { PaymentsAccountDeletionOwnerController } from '../../../payments/src/app/account-deletion-owner.controller';
import { DeletionOwnerFixture } from './deletion-owner.fixture';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
(process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture'
  ? describe
  : describe.skip)('D17 real Auth/Payments TCP deletion', () => {
  const f = new DeletionOwnerFixture();
  let client: any;
  const ids: Record<string, string> = {};
  let foreignRows: Record<string, unknown[]> = {};
  const classified = randomUUID();
  const payment = (buyerId: string, sellerId: string) => ({
    id: randomUUID(),
    classifiedId: classified,
    buyerId,
    sellerId,
    amount: '20.00',
    platformFeeAmount: '1.00',
    sellerReceivesAmount: '19.00',
    paymentIntentId: 'BUYER_PROVIDER_REF',
    proofImageUrl: 'BUYER_PRIVATE_PROOF',
    disputeReason: 'PRIVATE_DISPUTE',
  });
  const seed = async (
    key: string,
    table: string,
    data: Record<string, unknown>
  ) => (ids[key] = await f.seed(table, { id: randomUUID(), ...data }));
  const row = async (t: string, id: string) =>
    (await f.db.query(`SELECT * FROM "${t}" WHERE id=$1`, [id]))[0];
  beforeAll(async () => {
    const authority = await f.start(
      'd17_payments',
      loadDatabase({ get: () => ({}) } as never)
    );
    client = await f.serve(
      [PaymentsAccountDeletionOwnerController],
      [
        {
          provide: PaymentsAccountDeletionOwnerService,
          useValue: new PaymentsAccountDeletionOwnerService(f.db, authority),
        },
      ]
    );
    for (const [prefix, a, p] of [
      ['own', f.account, f.profile],
      ['foreign', f.other, f.otherProfile],
    ]) {
      await seed(prefix + 'Donation', 'donations', {
        userId: a,
        profileId: p,
        amount: '5.00',
        message: 'PRIVATE_DONATION',
        lemonSqueezyOrderId: 'ORDER',
      });
      await seed(prefix + 'Wallet', 'seller_wallets', {
        sellerId: a,
        availableBalance: '19.00',
        payoutEmail: prefix + '@example.test',
      });
      await seed(prefix + 'Event', 'payment_events', {
        userId: a,
        type: 'classified_payment',
        direction: 'incoming',
        amount: '20.00',
        platformFee: '1.00',
        netAmount: '19.00',
        description: 'PRIVATE_EVENT',
      });
      await seed(prefix + 'Payout', 'payout_requests', {
        sellerId: a,
        amount: '2.00',
        payoutMethod: 'paypal',
        payoutEmail: prefix + '@example.test',
      });
      await seed(prefix + 'Page', 'business_pages', {
        communityId: randomUUID(),
        ownerId: a,
        name: 'PRIVATE_BUSINESS',
        description: 'PRIVATE_DESCRIPTION',
        email: prefix + '@example.test',
        lemonSqueezySubscriptionId: 'PRIVATE_SUBSCRIPTION',
      });
      await seed(prefix + 'Theme', 'business_themes', {
        businessPageId: ids[prefix + 'Page'],
        customCss: prefix + 'PRIVATE_CSS',
      });
      await f.db.query(
        'UPDATE business_pages SET "businessThemeId"=$2 WHERE id=$1',
        [ids[prefix + 'Page'], ids[prefix + 'Theme']]
      );
      await seed(prefix + 'Sponsor', 'community_sponsorships', {
        communityId: randomUUID(),
        businessPageId: ids['ownPage'],
        userId: a,
        type: 'banner',
        adContent: prefix + 'PRIVATE_AD',
        amount: '8.00',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });
    }
    await seed('ownBuyer', 'classified_payments', payment(f.account, f.other));
    await seed('ownSeller', 'classified_payments', payment(f.other, f.account));
    await seed('ownInterest', 'classified_payments', {
      ...payment(f.other, f.other),
      interestedBuyerId: f.account,
    });
    await seed('ownOffer', 'offers', {
      classifiedId: classified,
      buyerId: f.account,
      sellerId: f.other,
      offeredAmount: '12.00',
      message: 'BUYER_PRIVATE',
      counterMessage: 'SELLER_COUNTERPART',
      expiresAt: new Date(Date.now() + 100000),
    });
    await seed('sellerOffer', 'offers', {
      classifiedId: classified,
      buyerId: f.other,
      sellerId: f.account,
      offeredAmount: '12.00',
      message: 'BUYER_COUNTERPART',
      counterMessage: 'SELLER_PRIVATE',
      expiresAt: new Date(Date.now() + 100000),
    });
    await seed('product', 'lemon_squeezy_products', {
      appScope: 'local-hub',
      tier: 'classified-fee',
      lemonSqueezyProductId: 'OPERATOR_PRODUCT',
    });
    // Previously deidentified history belongs to another operation, never a global nil-row cleanup.
    ids['legacyPayment'] = randomUUID();
    ids['legacyOffer'] = randomUUID();
    await f.db.transaction(async (m) => {
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        randomUUID(),
      ]);
      await m.query(
        'INSERT INTO classified_payments(id,"classifiedId","buyerId","sellerId",amount,"platformFeeAmount","sellerReceivesAmount") VALUES($1,$2,$3,$3,7,1,6)',
        [ids['legacyPayment'], randomUUID(), nil]
      );
      await m.query(
        'INSERT INTO offers(id,"classifiedId","buyerId","sellerId","offeredAmount","expiresAt") VALUES($1,$2,$3,$3,7,now())',
        [ids['legacyOffer'], randomUUID(), nil]
      );
    });
    const legacyPayment = await row(
      'classified_payments',
      ids['legacyPayment']
    );
    const legacyOffer = await row('offers', ids['legacyOffer']);
    foreignRows['classified_payments'] = [legacyPayment];
    foreignRows['offers'] = [legacyOffer];
    for (const [table, key] of [
      ['donations', 'foreignDonation'],
      ['seller_wallets', 'foreignWallet'],
      ['payment_events', 'foreignEvent'],
      ['payout_requests', 'foreignPayout'],
      ['business_pages', 'foreignPage'],
      ['business_themes', 'foreignTheme'],
      ['community_sponsorships', 'foreignSponsor'],
      ['lemon_squeezy_products', 'product'],
    ])
      foreignRows[table] = [await row(table, ids[key])];
  }, 30000);
  afterAll(() => f.close(), 30000);
  it('fences producers, removes own financial/private records and retains counterpart facts through retry', async () => {
    await expect(
      f.call(
        client,
        C.FENCE_ACCOUNT_DELETION,
        await f.grant('workspace', 'fence')
      )
    ).rejects.toBeTruthy();
    const fence = await f.grant('payments', 'fence');
    const bad = await f.seed('donations', {
      id: randomUUID(),
      userId: f.account,
      profileId: f.otherProfile,
      amount: '1.00',
    });
    await expect(
      f.call(client, C.FENCE_ACCOUNT_DELETION, fence)
    ).rejects.toBeTruthy();
    expect(
      await f.db.query('SELECT * FROM account_deletion_write_fence')
    ).toEqual([]);
    await f.db.query('DELETE FROM donations WHERE id=$1', [bad]);
    const writer = f.db.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    await writer.query(
      'UPDATE seller_wallets SET "availableBalance"="availableBalance" WHERE id=$1',
      [ids['ownWallet']]
    );
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
      f.db.query('UPDATE seller_wallets SET "sellerId"=$2 WHERE id=$1', [
        ids['ownWallet'],
        f.other,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      f.db.query('UPDATE seller_wallets SET "sellerId"=$2 WHERE id=$1', [
        ids['foreignWallet'],
        f.account,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await f.allFencePremises();
    const erase = await f.grant('payments', 'erase');
    await f.db.query(
      "CREATE FUNCTION d17_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D17_INJECTED';END $$"
    );
    await f.db.query(
      'CREATE TRIGGER d17_fault AFTER DELETE ON donations FOR EACH ROW EXECUTE FUNCTION d17_fault()'
    );
    await expect(
      f.call(client, C.ERASE_ACCOUNT_DELETION, erase)
    ).rejects.toBeTruthy();
    expect(await row('donations', ids['ownDonation'])).toBeTruthy();
    await f.db.query('DROP TRIGGER d17_fault ON donations');
    await f.db.query('DROP FUNCTION d17_fault()');
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
        await f.grant('payments', 'readback')
      )
    ).toEqual({ verified: true, remaining: 0 });
    for (const [table, key] of [
      ['donations', 'ownDonation'],
      ['seller_wallets', 'ownWallet'],
      ['payment_events', 'ownEvent'],
      ['payout_requests', 'ownPayout'],
      ['community_sponsorships', 'ownSponsor'],
      ['business_themes', 'ownTheme'],
    ])
      expect(await row(table, ids[key])).toBeUndefined();
    for (const [table, rows] of Object.entries(foreignRows))
      expect(await row(table, (rows[0] as any).id)).toEqual(rows[0]);
    const buyer = await row('classified_payments', ids['ownBuyer']);
    expect(buyer).toMatchObject({
      buyerId: nil,
      sellerId: f.other,
      amount: '20.00',
      paymentIntentId: null,
      proofImageUrl: null,
      disputeReason: null,
    });
    expect(await row('classified_payments', ids['ownSeller'])).toMatchObject({
      buyerId: f.other,
      sellerId: nil,
      amount: '20.00',
      paymentIntentId: 'BUYER_PROVIDER_REF',
      proofImageUrl: 'BUYER_PRIVATE_PROOF',
      disputeReason: null,
    });
    expect(await row('classified_payments', ids['ownInterest'])).toMatchObject({
      buyerId: f.other,
      sellerId: f.other,
      interestedBuyerId: null,
      proofImageUrl: 'BUYER_PRIVATE_PROOF',
    });
    expect(await row('offers', ids['ownOffer'])).toMatchObject({
      buyerId: nil,
      sellerId: f.other,
      message: null,
      counterMessage: 'SELLER_COUNTERPART',
    });
    expect(await row('offers', ids['sellerOffer'])).toMatchObject({
      buyerId: f.other,
      sellerId: nil,
      message: 'BUYER_COUNTERPART',
      counterMessage: null,
    });
    expect(await row('business_pages', ids['ownPage'])).toMatchObject({
      ownerId: nil,
      name: 'Deleted account business',
      email: null,
      description: null,
      businessThemeId: null,
      lemonSqueezySubscriptionId: null,
    });
    await expect(
      f.seed('seller_wallets', { id: randomUUID(), sellerId: f.account })
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      f.seed('business_themes', {
        id: randomUUID(),
        businessPageId: ids['ownPage'],
        customCss: 'STALE',
      })
    ).rejects.toThrow('PAYMENTS_DELETED_CONTAINER');
    await expect(
      f.db.query('UPDATE offers SET "buyerId"=$2 WHERE id=$1', [
        ids['ownOffer'],
        f.other,
      ])
    ).rejects.toThrow('PAYMENTS_DELETED_PARTICIPATION');
    await f.db.query(
      'UPDATE seller_wallets SET "availableBalance"="availableBalance"+1 WHERE id=$1',
      [ids['foreignWallet']]
    );
  }, 30000);
});
