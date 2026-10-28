import {
  checkR4Accessibility,
  checkR4Recovery,
  checkR4SocketRecovery,
} from './r4-recovery';
import { seedR4Permissions } from './r4-permission-fixture';
/** R4 opt-in journey proof. Actual guarded HTTP, TCP owners and browser bundles. */
import {
  chromium,
  expect as uiExpect,
  BrowserContext,
  Page,
} from '@playwright/test';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import {
  RoleInitService,
  RoleInitBuilder,
} from '@optimistic-tanuki/permission-lib';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionOwner,
} from '@optimistic-tanuki/models';
interface Options {
  settings: {
    root: string;
    base: {
      jwtSecret: string;
      endpoints: Record<string, { host: string; port: number }>;
    };
    gateways: Array<{ port: number }>;
  };
  dbs: Map<AccountDeletionOwner, DataSource>;
  workers: unknown[];
  account: string;
  profile: string;
  profile2: string;
  other: string;
  otherProfile: string;
  ids: Record<string, string>;
  tokens: Record<string, string>;
  seed(
    owner: AccountDeletionOwner,
    table: string,
    values: Record<string, unknown>
  ): Promise<any>;
}
export async function runR4Journeys(o: Options) {
  if (
    process.env['R4_JOURNEYS'] !== '1' ||
    process.env['D27_LIVE_FIXTURE'] !== 'private-d27-otts-v1'
  )
    throw Error('R4_PRIVATE_REQUIRED');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts: BrowserContext[] = [];
  const evidence: Record<string, unknown> = {
    scope: ['client-interface', 'local-hub'],
    status: 'in-progress',
    slices: {},
  };
  const save = async () =>
    writeFile(
      join(o.settings.root, 'r4-journeys.json'),
      JSON.stringify(evidence, null, 2),
      { mode: 0o600 }
    );
  const stage = async (name: string, work: () => Promise<void>) => {
    evidence['active'] = name;
    await save();
    await work();
    (evidence['slices'] as Record<string, unknown>)[name] = { passed: true };
    await save();
  };
  const permission = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: o.settings.base.endpoints['permissions'],
  });
  const roleInit = new RoleInitService(permission);
  const jwt = new JwtService({ secret: o.settings.base.jwtSecret });
  const foreignOt = await o.seed('profile', 'profile', {
    userId: o.other,
    appScope: 'client-interface',
    profileName: 'COUNTERPART_OT',
  });
  const secondary = await o.seed('profile', 'profile', {
    userId: o.account,
    appScope: null,
    profileName: 'OWN_SECONDARY',
  });
  const otherOt = jwt.sign({
    userId: o.other,
    profileId: foreignOt.id,
    appId: 'client-interface',
    name: 'COUNTERPART',
    email: o.other + '@example.test',
  });
  const otherOtSession = await o.seed('authentication', 'token', {
    userId: o.other,
    profileId: foreignOt.id,
    tokenData: otherOt,
  });
  const appInputs = [
    {
      app: 'client-interface',
      origin: 'http://127.0.0.1:19080',
      path: '/settings',
      token: o.tokens['ownOt'],
      otherToken: otherOt,
      profile: o.profile2,
    },
    {
      app: 'local-hub',
      origin: 'http://127.0.0.1:19081',
      path: '/account',
      token: o.tokens['ownTs'],
      otherToken: o.tokens['other'],
      profile: o.profile,
    },
  ];
  await o.dbs
    .get('authentication')!
    .query(
      'UPDATE user_entity SET "emailVerifiedAt"=clock_timestamp() WHERE id=ANY($1::uuid[])',
      [[o.account, o.other]]
    );
  evidence['permissionSeed'] = await seedR4Permissions(
    o.dbs.get('permissions')!
  );
  try {
    for (const a of appInputs)
      await roleInit.processNow(
        new RoleInitBuilder()
          .setScopeName(a.app)
          .setProfile(a.profile)
          .addDefaultProfileOwner(a.profile, a.app)
          .addAppScopeDefaults()
          .addAssetOwnerPermissions()
          .build()
      );
    await stage('R4-01', async () => {
      for (const a of appInputs) {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
        });
        contexts.push(context);
        await context.addCookies([
          {
            name: 'ot_session',
            value: a.token,
            url: a.origin,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const page = await context.newPage();
        const api = async (path: string, method = 'GET', data?: unknown) =>
          context.request.fetch(a.origin + '/api' + path, {
            method,
            headers: { 'x-ot-appscope': a.app, 'x-ot-session-mode': 'cookie' },
            data,
          });
        let response = await api('/authentication/session');
        expect(response.status()).toBe(200);
        expect((await response.json()).data.userId).toBe(o.account);
        await page.goto(a.origin + a.path, { waitUntil: 'domcontentloaded' });
        await uiExpect(page.locator('lib-account-rights')).toBeVisible({
          timeout: 20000,
        });
        await uiExpect(page.locator('lib-account-rights')).toContainText(
          'OWN_PRIVATE'
        );
        await page.reload();
        await uiExpect(page.locator('lib-account-rights')).toContainText(
          'OWN_PRIVATE'
        );
        response = await api('/authentication/issue', 'POST', {
          profileId: o.otherProfile,
        });
        expect(response.status()).toBe(403);
        response = await api('/authentication/issue', 'POST', {
          profileId: a.app === 'local-hub' ? o.profile2 : o.profile,
        });
        expect(response.status()).toBe(403);
        response = await api('/authentication/issue', 'POST', {
          profileId: secondary.id,
        });
        expect(response.status()).toBe(201);
        response = await api('/authentication/session');
        expect((await response.json()).data.profileId).toBe(secondary.id);
        response = await api('/authentication/issue', 'POST', {
          profileId: a.profile,
        });
        expect(response.status()).toBe(201);
        await context.addCookies([
          {
            name: 'ot_session',
            value: a.otherToken,
            url: a.origin,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        await page.reload();
        await uiExpect(page.locator('lib-account-rights')).toContainText(
          'COUNTERPART'
        );
        await uiExpect(page.locator('lib-account-rights')).not.toContainText(
          'OWN_PRIVATE'
        );
        response = await api('/authentication/issue', 'POST', {
          profileId: secondary.id,
        });
        expect(response.status()).toBe(403);
        await page.screenshot({
          path: join(o.settings.root, 'r4-01-' + a.app + '.png'),
        });
        await context.addCookies([
          {
            name: 'ot_session',
            value: a.token,
            url: a.origin,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
      }
    });
    const a = appInputs[1],
      seller = contexts[1];
    const buyer = await browser.newContext();
    contexts.push(buyer);
    await buyer.addCookies([
      {
        name: 'ot_session',
        value: a.otherToken,
        url: a.origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const outsider = await browser.newContext();
    contexts.push(outsider);
    const outsiderUser = await o.seed('authentication', 'user_entity', {
      email: randomUUID() + '@example.test',
      firstName: 'R4',
      lastName: 'Outsider',
      ageEligibilityStatus: 'adult',
      emailVerifiedAt: new Date(),
    });
    const outsiderProfile = await o.seed('profile', 'profile', {
      userId: outsiderUser.id,
      appScope: 'local-hub',
      profileName: 'R4 Outsider',
    });
    const outsiderToken = jwt.sign({
      userId: outsiderUser.id,
      profileId: outsiderProfile.id,
      appId: 'local-hub',
      name: 'R4 Outsider',
      email: outsiderUser.email,
    });
    await o.seed('authentication', 'token', {
      userId: outsiderUser.id,
      profileId: outsiderProfile.id,
      tokenData: outsiderToken,
    });
    await outsider.addCookies([
      {
        name: 'ot_session',
        value: outsiderToken,
        url: a.origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const request = async (
      context: BrowserContext,
      path: string,
      method = 'GET',
      data?: unknown
    ) =>
      context.request.fetch(a.origin + '/api' + path, {
        method,
        headers: { 'x-ot-appscope': 'local-hub' },
        data,
      });
    const good = async (
      response: Awaited<ReturnType<typeof request>>,
      status: number
    ) => {
      if (response.status() !== status)
        throw Error(
          'R4_HTTP_' +
            response.status() +
            '_EXPECTED_' +
            status +
            '_' +
            (await response.text()).slice(0, 500)
        );
      return response.json();
    };
    let city: any, community: any, listing: any, otGroup: any;
    let otMember!: BrowserContext;
    let buyerPage = await buyer.newPage();
    let sellerPage!: Page;
    await stage('R4-02', async () => {
      city = await good(
        await request(seller, '/social/community', 'POST', {
          name: 'R4 City',
          slug: 'r4-city-' + randomUUID(),
          description: 'Disposable locality',
          localityType: 'city',
          city: 'R4 City',
          countryCode: 'USA',
          adminArea: 'R4',
        }),
        201
      );
      community = await good(
        await request(seller, '/social/community', 'POST', {
          name: 'R4 Private Community',
          slug: 'r4-private-' + randomUUID(),
          description: 'Bounded membership',
          parentId: city.id,
          localityType: 'neighborhood',
          isPrivate: true,
          joinPolicy: 'approval_required',
        }),
        201
      );
      const overview = await good(
        await request(outsider, '/social/community/' + community.id),
        200
      );
      expect(overview.memberIds).toEqual([]);
      expect(overview.memberUserIds).toEqual([]);
      expect(overview.chatRoomId).toBeUndefined();
      expect(
        (
          await request(
            outsider,
            '/social/community/' + community.id + '/members'
          )
        ).status()
      ).toBe(403);
      const joined = await good(
        await request(
          buyer,
          '/social/community/' + community.id + '/join',
          'POST'
        ),
        201
      );
      expect(joined.status).toBe('pending');
      expect([403, 404]).toContain(
        (
          await request(
            outsider,
            '/social/community/members/' + joined.id + '/approve',
            'POST'
          )
        ).status()
      );
      const approved = await good(
        await request(
          seller,
          '/social/community/members/' + joined.id + '/approve',
          'POST'
        ),
        201
      );
      expect(approved.status).toBe('approved');
      expect(
        (await request(buyer, '/social/community/' + community.id)).status()
      ).toBe(200);
      await buyerPage.goto(a.origin + '/c/' + community.slug, {
        waitUntil: 'domcontentloaded',
      });
      await uiExpect(
        buyerPage.getByRole('heading', {
          name: 'R4 Private Community',
          exact: true,
        })
      ).toBeVisible({ timeout: 20000 });
      await uiExpect(
        buyerPage.getByRole('button', { name: 'Leave Community', exact: true })
      ).toBeVisible();
      await buyerPage.goto(a.origin + '/c/missing-r4-' + randomUUID(), {
        waitUntil: 'domcontentloaded',
      });
      await uiExpect(
        buyerPage.getByRole('button', { name: 'Browse All Cities' })
      ).toBeVisible();
      await buyerPage
        .getByRole('button', { name: 'Browse All Cities' })
        .click();
      await uiExpect(buyerPage).toHaveURL(/\/cities$/);
      const ot = appInputs[0],
        otBuyer = await browser.newContext();
      contexts.push(otBuyer);
      otMember = otBuyer;
      await otBuyer.addCookies([
        {
          name: 'ot_session',
          value: otherOt,
          url: ot.origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const otRequest = (
        c: BrowserContext,
        path: string,
        method = 'GET',
        data?: unknown
      ) =>
        c.request.fetch(ot.origin + '/api' + path, {
          method,
          headers: { 'x-ot-appscope': 'client-interface' },
          data,
        });
      const group = (otGroup = await good(
        await otRequest(contexts[0], '/social/community', 'POST', {
          name: 'R4 OT Group',
          description: 'OT membership boundary',
          isPrivate: true,
          joinPolicy: 'approval_required',
        }),
        201
      ));
      expect(
        (
          await otRequest(otBuyer, '/social/community/' + group.id + '/members')
        ).status()
      ).toBe(403);
      const requestToJoin = await good(
        await otRequest(
          otBuyer,
          '/social/community/' + group.id + '/join',
          'POST'
        ),
        201
      );
      expect(requestToJoin.status).toBe('pending');
      expect(
        (
          await otRequest(
            otBuyer,
            '/social/community/members/' + requestToJoin.id + '/approve',
            'POST'
          )
        ).status()
      ).toBe(403);
      expect(
        (
          await otRequest(
            contexts[0],
            '/social/community/members/' + requestToJoin.id + '/approve',
            'POST'
          )
        ).status()
      ).toBe(201);
      expect(
        (
          await otRequest(otBuyer, '/social/community/' + group.id + '/members')
        ).status()
      ).toBe(200);
      const otPage = await otBuyer.newPage();
      await otPage.goto(ot.origin + '/communities/' + group.slug, {
        waitUntil: 'domcontentloaded',
      });
      await uiExpect(
        otPage.getByRole('heading', { name: 'R4 OT Group', exact: true })
      ).toBeVisible({ timeout: 20000 });
    });
    await stage('R4-03', async () => {
      listing = await good(
        await request(seller, '/classifieds', 'POST', {
          title: 'R4 Verified Bicycle',
          description: 'Disposable buyer/seller journey',
          price: 125,
          currency: 'USD',
          category: 'for-sale',
          communityId: community.id,
        }),
        201
      );
      for (const amount of [-1, 0, 0.01, 100000000]) {
        expect(
          (
            await request(buyer, '/payments/offers', 'POST', {
              classifiedId: listing.id,
              amount,
            })
          ).status()
        ).toBe(400);
      }
      expect(
        await o.dbs
          .get('payments')!
          .query('SELECT id FROM offers WHERE "classifiedId"=$1', [listing.id])
      ).toHaveLength(0);
      await buyerPage.goto(
        a.origin + '/c/' + community.slug + '/classifieds/' + listing.id,
        { waitUntil: 'domcontentloaded' }
      );
      await uiExpect(
        buyerPage.getByRole('heading', {
          name: 'R4 Verified Bicycle',
          exact: true,
        })
      ).toBeVisible({ timeout: 20000 });
      await buyerPage
        .getByRole('button', { name: 'Make an Offer', exact: true })
        .click();
      await buyerPage.getByLabel('Your Offer').fill('100');
      await buyerPage.getByLabel('Message (optional)').fill('R4 bounded offer');
      await buyerPage
        .getByRole('button', { name: 'Submit Offer', exact: true })
        .click();
      await uiExpect(buyerPage.getByLabel('Your Offer')).not.toBeVisible();
      const rows = await o.dbs
        .get('payments')!
        .query('SELECT * FROM offers WHERE "classifiedId"=$1', [listing.id]);
      expect(rows).toHaveLength(1);
      const offer = rows[0];
      expect(offer.buyerId).toBe(o.other);
      expect(offer.sellerId).toBe(o.account);
      expect([400, 403, 404]).toContain(
        (
          await request(
            outsider,
            '/payments/offers/' + offer.id + '/accept',
            'PATCH'
          )
        ).status()
      );
      sellerPage = await seller.newPage();
      await sellerPage.goto(
        a.origin + '/c/' + community.slug + '/classifieds/' + listing.id,
        { waitUntil: 'domcontentloaded' }
      );
      await sellerPage
        .getByRole('button', { name: 'View Offers', exact: true })
        .click();
      const acceptedResponse = sellerPage.waitForResponse((r) =>
        r.url().endsWith('/api/payments/offers/' + offer.id + '/accept')
      );
      sellerPage.once('dialog', (dialog) => dialog.accept());
      await sellerPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Accept', exact: true })
        .click();
      const acceptedHttp = await acceptedResponse;
      expect(acceptedHttp.status()).toBe(200);
      const accepted = await acceptedHttp.json();
      await uiExpect(
        sellerPage.getByText(
          'Offer accepted. Card payment is pending and has not been processed.',
          { exact: true }
        )
      ).toBeVisible();
      expect(accepted.offer.status).toBe('accepted');
      const payments = await o.dbs
        .get('payments')!
        .query('SELECT * FROM classified_payments WHERE "classifiedId"=$1', [
          listing.id,
        ]);
      expect(payments).toHaveLength(1);
      const card = payments[0];
      expect(Number(card.amount)).toBe(100);
      expect(
        (
          await request(
            buyer,
            '/payments/classifieds/payment/' + card.id + '/confirm',
            'POST',
            {}
          )
        ).status()
      ).toBe(400);
      const payment = await good(
        await request(buyer, '/payments/classifieds/payment', 'POST', {
          classifiedId: listing.id,
          paymentMethod: 'cash',
          amount: 1,
          sellerId: outsiderUser.id,
        }),
        201
      );
      expect(Number(payment.amount)).toBe(125);
      expect(payment.sellerId).toBe(o.account);
      expect([400, 403, 404]).toContain(
        (
          await request(outsider, '/payments/classifieds/payment/' + payment.id)
        ).status()
      );
      expect([400, 403, 404]).toContain(
        (
          await request(
            buyer,
            '/payments/classifieds/payment/' + payment.id + '/release',
            'POST'
          )
        ).status()
      );
      const walletBefore = (
        await o.dbs
          .get('payments')!
          .query(
            'SELECT "availableBalance","totalEarned" FROM seller_wallets WHERE "sellerId"=$1',
            [o.account]
          )
      )[0];
      const confirmed = await good(
        await request(
          buyer,
          '/payments/classifieds/payment/' + payment.id + '/confirm',
          'POST',
          {}
        ),
        201
      );
      expect(confirmed.payment.status).toBe('confirmed');
      const released = await good(
        await request(
          seller,
          '/payments/classifieds/payment/' + payment.id + '/release',
          'POST'
        ),
        201
      );
      expect(released.payment.status).toBe('released');
      const duplicate = await request(
        seller,
        '/payments/classifieds/payment/' + payment.id + '/release',
        'POST'
      );
      expect(duplicate.status()).toBe(201);
      expect((await duplicate.json()).alreadyReleased).toBe(true);
      const walletAfter = (
        await o.dbs
          .get('payments')!
          .query(
            'SELECT "availableBalance","totalEarned" FROM seller_wallets WHERE "sellerId"=$1',
            [o.account]
          )
      )[0];
      expect(Number(walletAfter.availableBalance)).toBeCloseTo(
        Number(walletBefore.availableBalance) +
          Number(payment.sellerReceivesAmount),
        2
      );
      expect(Number(walletAfter.totalEarned)).toBeCloseTo(
        Number(walletBefore.totalEarned) + Number(payment.sellerReceivesAmount),
        2
      );

      expect(
        (
          await o.dbs
            .get('payments')!
            .query(
              'SELECT count(*)::text AS n FROM classified_payments WHERE "classifiedId"=$1',
              [listing.id]
            )
        )[0].n
      ).toBe('2');
    });
    await stage('R4-04', async () => {
      for (let i = 0; i < appInputs.length; i++) {
        const current = appInputs[i],
          page = contexts[i].pages()[0];
        await page.goto(current.origin + current.path, {
          waitUntil: 'domcontentloaded',
        });
        await uiExpect(page.locator('lib-account-rights')).toBeVisible();
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await checkR4Accessibility(
            page,
            'lib-account-rights',
            join(
              o.settings.root,
              'r4-04-' + current.app + '-' + width + '.json'
            )
          );
          await page.screenshot({
            path: join(
              o.settings.root,
              'r4-04-' + current.app + '-' + width + '.png'
            ),
          });
        }
      }
      for (const width of [390, 1280]) {
        await sellerPage.setViewportSize({ width, height: 900 });
        await checkR4Accessibility(
          sellerPage,
          'otui-modal',
          join(o.settings.root, 'r4-04-seller-' + width + '.json')
        );
      }
      await sellerPage.keyboard.press('Escape');
      await uiExpect(sellerPage.getByRole('dialog')).not.toBeVisible();
      await uiExpect(
        sellerPage.getByRole('button', { name: 'View Offers', exact: true })
      ).toBeFocused();
      await buyerPage.goto(
        a.origin + '/c/' + community.slug + '/classifieds/' + listing.id,
        { waitUntil: 'domcontentloaded' }
      );
      const trigger = buyerPage.getByRole('button', {
        name: 'Make an Offer',
        exact: true,
      });
      await uiExpect(trigger).toBeVisible();
      await trigger.focus();
      await buyerPage.keyboard.press('Enter');
      await uiExpect(
        buyerPage.getByRole('dialog', { name: 'Make an Offer', exact: true })
      ).toBeVisible();
      for (let n = 0; n < 10; n++) {
        await buyerPage.keyboard.press('Tab');
        expect(
          await buyerPage.evaluate(
            () => !!document.activeElement?.closest('[role=dialog]')
          )
        ).toBe(true);
      }
      for (const width of [390, 1280]) {
        await buyerPage.setViewportSize({ width, height: 900 });
        await checkR4Accessibility(
          buyerPage,
          'otui-modal',
          join(o.settings.root, 'r4-04-offer-' + width + '.json')
        );
      }
      await buyerPage.keyboard.press('Escape');
      await uiExpect(buyerPage.getByRole('dialog')).not.toBeVisible();
      await uiExpect(trigger).toBeFocused();
    });
    await stage('R4-05', async () => {
      await checkR4Recovery({
        root: o.settings.root,
        gateway: o.settings.gateways[1].port,
        database: o.dbs.get('assets')!,
        payments: o.dbs.get('payments')!,
        chat: o.dbs.get('chat-collector')!,
        authentication: o.dbs.get('authentication')!,
        seller,
        buyer,
        outsider,
        page: buyerPage,
        profile: o.profile,
        buyerProfile: o.otherProfile,
        token: a.otherToken,
        tokenId: o.ids['otherSession'],
        community,
        listing,
        origin: a.origin,
      });

      const ot = appInputs[0];
      const upload = await contexts[0].request.post(ot.origin + '/api/asset', {
        headers: { 'x-ot-appscope': 'client-interface' },
        data: {
          name: 'r4-ot-upload.png',
          profileId: o.profile2,
          type: 'image',
          communityId: otGroup.id,
          fileExtension: 'png',
          content:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h3sAAAAASUVORK5CYII=',
        },
      });
      expect(upload.status()).toBe(201);
      const uploaded = await upload.json();
      expect(
        (
          await otMember.request.get(ot.origin + '/api/asset/' + uploaded.id, {
            headers: { 'x-ot-appscope': 'client-interface' },
          })
        ).status()
      ).toBe(200);
      await checkR4SocketRecovery({
        gateway: o.settings.gateways[0].port,
        origin: ot.origin,
        buyer: otMember,
        token: otherOt,
        tokenId: otherOtSession.id,
        buyerProfile: foreignOt.id,
        profile: o.profile2,
        chat: o.dbs.get('chat-collector')!,
        authentication: o.dbs.get('authentication')!,
      });
    });
    evidence['status'] = 'verified-local';
    evidence['active'] = null;
    await save();
    await writeFile(
      join(o.settings.root, 'result.json'),
      JSON.stringify(
        {
          acceptedJourneys: true,
          acceptedLocalProtocol: false,
          owners: [...ACCOUNT_DELETION_OWNERS],
          slices: Object.keys(evidence['slices'] as object),
          scope: ['client-interface', 'local-hub'],
          externalProvidersQualified: false,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  } finally {
    await save();
    permission.close();
    for (const c of contexts) await c.close();
    await browser.close();
  }
}
