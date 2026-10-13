import { expect, test } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('RR10 V01 late initial community response cannot overwrite browser Back navigation', async ({
  page,
}) => {
  test.skip(
    process.env['RR10_V01_LIVE_STACK'] !== 'true',
    'Requires controlled local fixtures'
  );
  test.setTimeout(60_000);
  const root = process.cwd().endsWith('apps/client-interface-e2e')
    ? resolve('../..')
    : process.cwd();
  const credentials = JSON.parse(
    readFileSync(process.env['RR10_V01_CREDENTIALS_FILE']!, 'utf8')
  );
  const origin = 'http://127.0.0.1:8080';
  const headers = {
    'X-ot-appscope': 'client-interface',
    'X-ot-session-mode': 'cookie',
  };
  const fixtures: Array<{
    id: string;
    slug: string;
    name: string;
    roomId: string;
  }> = [];
  let release: (() => void) | undefined;
  const chat = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3007 },
  });
  try {
    const login = await page.request.post(
      `${origin}/api/authentication/login`,
      { headers, data: credentials }
    );
    expect(login.status()).toBe(201);
    const session = await page.request.get(
      `${origin}/api/authentication/session`,
      { headers }
    );
    const owner = (await session.json()).data.profileId;
    for (const label of ['late', 'current']) {
      const marker = randomUUID();
      const created = await page.request.post(
        `${origin}/api/social/community`,
        {
          headers,
          data: {
            name: `RR10 V01 ${label} ${marker}`,
            slug: `rr10-v01-${marker}`,
            description: 'Controlled route-race fixture',
            joinPolicy: 'public',
          },
        }
      );
      expect(created.status()).toBe(201);
      const community = await created.json();
      const fixture = {
        id: community.id,
        slug: community.slug,
        name: community.name,
        roomId: '',
      };
      fixtures.push(fixture);
      const room = await page.request.post(
        `${origin}/api/social/community/${fixture.id}/chat-room`,
        { headers }
      );
      expect(room.status()).toBe(201);
      fixture.roomId = (await room.json()).id;
    }
    const [late, current] = fixtures;
    await page.goto(`${origin}/communities/${current.slug}/chat`);
    await expect(
      page
        .locator('lib-community-chat .contact-item')
        .filter({ hasText: current.name })
    ).toBeVisible();
    let held: (() => void) | undefined;
    const intercepted = new Promise<void>((done) => {
      held = done;
    });
    const delayed = new Promise<void>((done) => {
      release = done;
    });
    let fulfilled: (() => void) | undefined;
    const oldFinished = new Promise<void>((done) => {
      fulfilled = done;
    });
    await page.route(
      `**/api/social/community/slug/${late.slug}*`,
      async (route) => {
        const response = await route.fetch();
        held!();
        await delayed;
        await route.fulfill({ response });
        fulfilled!();
      }
    );
    // Popstate is the browser navigation boundary used by Angular's router;
    // Back below must reuse the mounted route while the initial lookup is held.
    await page.evaluate((slug) => {
      history.pushState(history.state, '', `/communities/${slug}/chat`);
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, late.slug);
    await intercepted;
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`/communities/${current.slug}/chat`)
    );
    await expect(
      page
        .locator('lib-community-chat .contact-item')
        .filter({ hasText: current.name })
    ).toBeVisible();
    release!();
    await oldFinished;
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    );
    await expect(
      page
        .locator('lib-community-chat .contact-item')
        .filter({ hasText: current.name })
    ).toBeVisible();
    await expect(
      page
        .locator('lib-community-chat .contact-item')
        .filter({ hasText: late.name })
    ).toHaveCount(0);
    await page.unroute(`**/api/social/community/slug/${late.slug}*`);
    const profileInterrupted = new Promise<void>((done) => {
      held = done;
    });
    const profileReleased = new Promise<void>((done) => {
      release = done;
    });
    const profileFinished = new Promise<void>((done) => {
      fulfilled = done;
    });
    await page.route(
      `**/api/social/community/slug/${late.slug}*`,
      async (route) => {
        const response = await route.fetch();
        held!();
        await profileReleased;
        await route.fulfill({ response });
        fulfilled!();
      }
    );
    await page.evaluate((slug) => {
      history.pushState(history.state, '', `/communities/${slug}/chat`);
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, late.slug);
    await profileInterrupted;
    await page.locator('otui-app-bar otui-button').first().click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    release!();
    await profileFinished;
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    );
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.locator('lib-community-chat')).toHaveCount(0);
    const main = await page.request.get(`${origin}/main.js`);
    const servedHash = createHash('sha256')
      .update(await main.body())
      .digest('hex');
    expect(servedHash).toBe(
      createHash('sha256')
        .update(
          readFileSync(
            resolve(root, 'dist/apps/client-interface/browser/main.js')
          )
        )
        .digest('hex')
    );
    const evidence = resolve(
      root,
      '.runtime-artifacts/rr10/final-route-race.json'
    );
    mkdirSync(resolve(root, '.runtime-artifacts/rr10'), {
      recursive: true,
      mode: 0o700,
    });
    writeFileSync(
      evidence,
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          browserBackPreservedCurrentCommunity: true,
          delayedOldResponseDelivered: true,
          delayedResponseAfterSignOutIgnored: true,
          servedMainSha256: servedHash,
          sourceSha256: createHash('sha256')
            .update(
              readFileSync(
                resolve(
                  root,
                  'libs/community-ui/src/lib/community-ui/community-chat/community-chat.component.ts'
                )
              )
            )
            .digest('hex'),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
    await chat.connect();
    for (const fixture of fixtures) {
      await firstValueFrom(
        chat
          .send(
            { cmd: 'DELETE_OWNED_COMMUNITY_CONVERSATION' },
            {
              conversationId: fixture.roomId,
              communityId: fixture.id,
              actorProfileId: owner,
              appScope: 'client-interface',
            }
          )
          .pipe(timeout(5000))
      );
      fixture.roomId = '';
    }
  } finally {
    release?.();
    chat.close();
    const restore = await page.request.post(
      `${origin}/api/authentication/login`,
      { headers, data: credentials }
    );
    expect.soft(restore.status()).toBe(201);
    for (const fixture of fixtures) {
      const deleted = await page.request.delete(
        `${origin}/api/social/community/${fixture.id}`,
        { headers }
      );
      expect.soft(deleted.status()).toBe(200);
      const readback = await page.request.get(
        `${origin}/api/social/community/${fixture.id}`,
        { headers }
      );
      const body = (await readback.text()).trim();
      expect
        .soft(
          readback.status() === 404 ||
            (readback.status() === 200 && (body === '' || body === 'null'))
        )
        .toBe(true);
    }
  }
});
