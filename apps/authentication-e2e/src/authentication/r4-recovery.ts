import { BrowserContext, expect as uiExpect, Page } from '@playwright/test';
import { DataSource } from 'typeorm';
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function checkR4Accessibility(
  page: Page,
  selector: string,
  artifact: string
) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate((selector) => {
    const axe = (window as any).axe;
    return axe
      .run(
        { include: [[selector]] },
        {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
        }
      )
      .then((report: any) => ({
        violations: report.violations.map((v: any) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n: any) => ({
            target: n.target,
            summary: n.failureSummary,
            colors: Array.from(
              document.querySelectorAll(n.target.join(' '))
            ).map((element: any) => {
              const style = getComputedStyle(element);
              return {
                foreground: style.color,
                background: style.backgroundColor,
                danger: style.getPropertyValue('--danger'),
                onDanger: style.getPropertyValue('--on-danger'),
                opacity: style.opacity,
              };
            }),
          })),
        })),
        passes: report.passes.length,
      }));
  }, selector);
  await writeFile(artifact, JSON.stringify(result, null, 2), { mode: 0o600 });
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
}
export async function checkR4Recovery(o: {
  root: string;
  gateway: number;
  database: DataSource;
  payments: DataSource;
  chat: DataSource;
  authentication: DataSource;
  seller: BrowserContext;
  buyer: BrowserContext;
  outsider: BrowserContext;
  page: Page;
  profile: string;
  buyerProfile: string;
  token: string;
  tokenId: string;
  community: any;
  listing: any;
  origin: string;
}) {
  const request = (
    context: BrowserContext,
    path: string,
    method = 'GET',
    data?: unknown
  ) =>
    context.request.fetch(o.origin + '/api' + path, {
      method,
      headers: { 'x-ot-appscope': 'local-hub' },
      data,
    });
  const root = join(o.root, 'runtime', 'assets', 'assets');
  const original = (await readdir(root)).sort();
  await o.database.query('CREATE SEQUENCE r4_upload_fault_hits');
  await o.database.query(
    `CREATE FUNCTION r4_upload_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='r4-retry.png' AND NEW."lifecycleState"='active' THEN PERFORM nextval('r4_upload_fault_hits'); RAISE EXCEPTION 'R4_ACTIVATION_FAILED'; END IF; RETURN NEW; END $$`
  );
  await o.database.query(
    'CREATE TRIGGER r4_upload_fault BEFORE UPDATE ON asset_entity FOR EACH ROW EXECUTE FUNCTION r4_upload_fault()'
  );
  const data = {
    name: 'r4-retry.png',
    profileId: o.profile,
    type: 'image',
    communityId: o.community.id,
    fileExtension: 'png',
    content:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h3sAAAAASUVORK5CYII=',
  };
  try {
    expect((await request(o.seller, '/asset', 'POST', data)).status()).toBe(
      500
    );
    const hits = await o.database.query(
      'SELECT last_value,is_called FROM r4_upload_fault_hits'
    );
    expect(hits[0].is_called).toBe(true);
    expect(Number(hits[0].last_value)).toBe(1);
  } finally {
    await o.database.query('DROP TRIGGER r4_upload_fault ON asset_entity');
    await o.database.query('DROP FUNCTION r4_upload_fault()');
    await o.database.query('DROP SEQUENCE r4_upload_fault_hits');
  }
  expect(
    (
      await o.database.query(
        'SELECT count(*)::text AS n FROM asset_entity WHERE name=$1',
        [data.name]
      )
    )[0].n
  ).toBe('0');
  expect((await readdir(root)).sort()).toEqual(original);
  const uploaded = await request(o.seller, '/asset', 'POST', data);
  if (uploaded.status() !== 201)
    throw Error(
      'R4_UPLOAD_RETRY_' +
        uploaded.status() +
        '_' +
        (await uploaded.text()).slice(0, 500)
    );
  const asset = await uploaded.json();
  expect(asset.id).toEqual(expect.any(String));
  expect(
    (
      await o.database.query(
        'SELECT count(*)::text AS n FROM asset_entity WHERE name=$1',
        [data.name]
      )
    )[0].n
  ).toBe('1');
  expect([403, 404]).toContain(
    (await request(o.outsider, '/asset/' + asset.id)).status()
  );
  // A request aborted before wire delivery preserves the draft and allows one explicit retry.
  await o.page.goto(
    o.origin + '/c/' + o.community.slug + '/classifieds/' + o.listing.id,
    { waitUntil: 'domcontentloaded' }
  );
  const trigger = o.page.getByRole('button', {
    name: 'Make an Offer',
    exact: true,
  });
  await uiExpect(trigger).toBeVisible();
  await trigger.click();
  await o.page.getByLabel('Your Offer').fill('95');
  const before = (
    await o.database.query(
      'SELECT count(*)::text AS n FROM asset_entity WHERE name=$1',
      [data.name]
    )
  )[0].n;
  const offerCount = async () =>
    Number(
      (
        await o.payments.query(
          'SELECT count(*)::text AS n FROM offers WHERE "classifiedId"=$1',
          [o.listing.id]
        )
      )[0].n
    );
  const beforeOffers = await offerCount();
  await o.page.route('**/api/payments/offers', (route) =>
    route.abort('connectionfailed')
  );
  await o.page
    .getByRole('button', { name: 'Submit Offer', exact: true })
    .click();
  await uiExpect(o.page.getByRole('alert')).toContainText(
    'Failed to submit offer'
  );
  await uiExpect(o.page.getByLabel('Your Offer')).toHaveValue('95');
  expect(await offerCount()).toBe(beforeOffers);
  await o.page.unroute('**/api/payments/offers');
  await o.page
    .getByRole('button', { name: 'Submit Offer', exact: true })
    .click();
  await uiExpect(o.page.getByLabel('Your Offer')).not.toBeVisible();
  expect(await offerCount()).toBe(beforeOffers + 1);
  expect(
    (
      await o.database.query(
        'SELECT count(*)::text AS n FROM asset_entity WHERE name=$1',
        [data.name]
      )
    )[0].n
  ).toBe(before);
  await o.page.reload();
  await uiExpect(
    o.page.getByRole('heading', { name: o.listing.title, exact: true })
  ).toBeVisible();
  await checkR4SocketRecovery(o);
}
export async function checkR4SocketRecovery(o: {
  gateway: number;
  origin: string;
  buyer: BrowserContext;
  token: string;
  tokenId: string;
  buyerProfile: string;
  profile: string;
  chat: DataSource;
  authentication: DataSource;
}) {
  const request = (context: BrowserContext, path: string) =>
    context.request.get(o.origin + '/api' + path, {
      headers: {
        'x-ot-appscope': o.origin.endsWith('19080')
          ? 'client-interface'
          : 'local-hub',
      },
    });
  const created = await o.buyer.request.post(
    o.origin + '/api/chat/conversations/direct/get-or-create',
    {
      headers: {
        'x-ot-appscope': o.origin.endsWith('19080')
          ? 'client-interface'
          : 'local-hub',
      },
      data: { recipientProfileId: o.profile },
    }
  );
  if (created.status() !== 201)
    throw Error(
      'R4_DIRECT_CHAT_' +
        created.status() +
        '_' +
        (await created.text()).slice(0, 500)
    );
  const conversation = await created.json();
  const socket = io('http://127.0.0.1:' + o.gateway + '/chat', {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Cookie: 'ot_session=' + o.token, Origin: o.origin },
  });
  const connect = () =>
    new Promise<void>((done, reject) => {
      const timer = setTimeout(() => reject(Error('R4_SOCKET_TIMEOUT')), 15000);
      socket.once('private-ready', () => {
        clearTimeout(timer);
        done();
      });
      socket.connect();
    });
  const id = randomUUID(),
    content = 'R4 reconnect durable message';
  try {
    await connect();
    const message = {
      id,
      conversationId: conversation.id,
      content,
      senderId: o.buyerProfile,
      recipientIds: [o.profile],
      type: 'chat',
    };
    let ack = await socket.timeout(15000).emitWithAck('message', message);
    expect(ack.success).toBe(true);
    socket.disconnect();
    await connect();
    ack = await socket.timeout(15000).emitWithAck('message', message);
    expect(ack.success).toBe(true);
    expect(
      (
        await o.chat.query(
          'SELECT count(*)::text AS n FROM message WHERE id=$1::uuid',
          [id]
        )
      )[0].n
    ).toBe('1');
    await o.authentication.query(
      'UPDATE token SET revoked=true WHERE id=$1::uuid',
      [o.tokenId]
    );
    ack = await socket.timeout(15000).emitWithAck('message', {
      ...message,
      id: randomUUID(),
      content: 'R4 denied late message',
    });
    expect(ack.success).toBe(false);
    expect(
      (
        await o.chat.query(
          'SELECT count(*)::text AS n FROM message WHERE content=$1',
          ['R4 denied late message']
        )
      )[0].n
    ).toBe('0');
    expect(
      (await request(o.buyer, '/chat/messages/' + conversation.id)).status()
    ).toBe(401);
  } finally {
    socket.disconnect();
  }
}
