import { test, expect, APIRequestContext } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { io } from 'socket.io-client';

// Release-gate checks against the existing stack, without intercepted APIs.
// Restricted fixtures use the owning service because the HTTP write DTO does
// not expose audience selection yet. These do not prove composer acceptance.
test.skip(
  process.env['RR04_LIVE_STACK'] !== 'true',
  'Requires the development stack'
);
const origin = 'http://127.0.0.1:8080';
const password = 'RR04-local-test-password!';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
async function account(request: APIRequestContext, suffix: string) {
  const email = `rr04-${Date.now()}-${suffix}@example.test`;
  const registration = await request.post(
    origin + '/api/authentication/register',
    {
      headers,
      data: {
        fn: 'RR04',
        ln: suffix,
        email,
        password,
        confirm: password,
        bio: 'Local privacy regression',
      },
    }
  );
  expect(registration.status()).toBe(201);
  const login = await request.post(origin + '/api/authentication/login', {
    headers: { ...headers, 'x-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status()).toBe(201);
  const session = await request.get(origin + '/api/authentication/session', {
    headers,
  });
  expect(session.status()).toBe(200);
  return { email, ...(await session.json()).data };
}
async function fixture(
  author: { userId: string; profileId: string },
  community: boolean
) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const communityId = community
      ? (
          await firstValueFrom(
            client.send(
              { cmd: 'CREATE_COMMUNITY' },
              {
                dto: {
                  name: `RR04 private ${Date.now()}`,
                  isPrivate: true,
                  joinPolicy: 'invite_only',
                },
                userId: author.userId,
                profileId: author.profileId,
                appScope: 'social',
              }
            )
          )
        ).id
      : undefined;
    const marker = `RR04 restricted marker ${Date.now()}`;
    const post = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: marker,
          content: marker,
          userId: author.userId,
          profileId: author.profileId,
          appScope: 'social',
          ...(communityId ? { communityId } : {}),
        }
      )
    );
    if (!community)
      await firstValueFrom(
        client.send(
          { cmd: 'UPDATE_POST' },
          {
            id: post.id,
            data: { visibility: 'followers' },
            userId: author.userId,
            profileId: author.profileId,
          }
        )
      );
    return { id: post.id, marker };
  } finally {
    client.close();
  }
}

test('RR04 API: anonymous and non-followers cannot read a followers-only post', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  try {
    const author = await account(authorContext, 'author');
    const outsider = await account(outsiderContext, 'outsider');
    const post = await fixture(author, false);
    const url = origin + `/api/social/post/${post.id}/shared`;
    expect((await (await authorContext.get(url)).json()).content).toBe(
      post.marker
    );
    for (const reader of [anonymous, outsiderContext]) {
      const response = await reader.get(url);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain(post.marker);
      const search = await reader.post(origin + '/api/social/post/find', {
        headers: { 'x-ot-appscope': 'social' },
        data: { criteria: { title: post.marker } },
      });
      expect(search.status()).toBe(201);
      expect(await search.text()).not.toContain(post.marker);
    }
    const follow = {
      followerId: outsider.profileId,
      followeeId: author.profileId,
    };
    expect(
      (
        await outsiderContext.post(origin + '/api/social/follow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    expect((await (await outsiderContext.get(url)).json()).content).toBe(
      post.marker
    );
    const report = { contentType: 'post', contentId: post.id, reason: 'spam' };
    expect(
      (
        await outsiderContext.post(origin + '/api/privacy/report', {
          headers: { 'x-ot-appscope': 'social' },
          data: report,
        })
      ).status()
    ).toBe(201);
    expect(
      (
        await outsiderContext.post(origin + '/api/social/follow/unfollow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    expect(await (await outsiderContext.get(url)).text()).not.toContain(
      post.marker
    );
    expect(
      (
        await outsiderContext.post(origin + '/api/privacy/report', {
          headers: { 'x-ot-appscope': 'social' },
          data: report,
        })
      ).status()
    ).toBe(400);
  } finally {
    await authorContext.dispose();
    await outsiderContext.dispose();
    await anonymous.dispose();
  }
});

test('RR04 browser: private-community direct post is visible to its author and hidden from a non-member', async ({
  browser,
}) => {
  const authorContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  try {
    const author = await account(authorContext.request, 'community-author');
    const outsider = await account(
      outsiderContext.request,
      'community-outsider'
    );
    const post = await fixture(author, true);
    expect(
      (
        await (
          await authorContext.request.get(
            origin + `/api/social/post/${post.id}/shared`
          )
        ).json()
      ).content
    ).toBe(post.marker);
    for (const [context, user] of [
      [authorContext, author],
      [outsiderContext, outsider],
    ] as const) {
      await context.clearCookies();
      const page = await context.newPage();
      page.on('response', (response) => {
        if (response.url().includes('/api/social/post/'))
          console.log(
            'Post response',
            response.status(),
            new URL(response.url()).pathname
          );
      });
      await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page).not.toHaveURL(/\/login$/);
      await page.goto(origin + `/feed/post/${post.id}`, {
        waitUntil: 'domcontentloaded',
      });
      if (user === author)
        await expect(
          page.getByText(post.marker, { exact: true }).first()
        ).toBeVisible();
      else {
        // A backend denial is required even if the UI happens to hide the post.
        const response = await context.request.get(
          origin + `/api/social/post/${post.id}/shared`
        );
        expect(await response.text()).not.toContain(post.marker);
        await expect(page.getByText(post.marker, { exact: true })).toHaveCount(
          0
        );
      }
    }
  } finally {
    await Promise.allSettled([authorContext.close(), outsiderContext.close()]);
  }
});

test('RR04 realtime: a non-follower does not receive followers-only updates', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  let socket: ReturnType<typeof io> | undefined;
  try {
    const author = await account(authorContext, 'socket-author');
    const outsider = await account(outsiderContext, 'socket-outsider');
    const post = await fixture(author, false);
    const cookies = (await outsiderContext.storageState()).cookies;
    socket = io('http://127.0.0.1:3301/social', {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
      },
    });
    const client = socket;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Socket connection timeout')),
        10000
      );
      client.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    // Connection acknowledgement precedes async server-side session validation.
    // Retry subscription until its acknowledgement; do not assume connect means ready.
    await new Promise<void>((resolve, reject) => {
      const retry = setInterval(
        () => client.emit('SUBSCRIBE_POSTS', { profileId: outsider.profileId }),
        200
      );
      const deadline = setTimeout(() => {
        clearInterval(retry);
        reject(new Error('Subscription timeout'));
      }, 10000);
      client.once('subscribed', () => {
        clearInterval(retry);
        clearTimeout(deadline);
        resolve();
      });
    });
    let finishObservation: (payload: unknown) => void = () => undefined;
    const received = new Promise<unknown>((resolve) => {
      finishObservation = resolve;
      client.once('post_updated', resolve);
    });
    const update = await authorContext.put(
      origin + `/api/social/post/update/${post.id}`,
      {
        headers: { 'x-ot-appscope': 'social' },
        data: { content: post.marker },
      }
    );
    expect(update.status()).toBe(200);
    // Start the absence window after the triggering request succeeds, so a
    // slow HTTP response cannot make this privacy assertion pass prematurely.
    const deadline = setTimeout(() => finishObservation(null), 1500);
    const payload = await received;
    clearTimeout(deadline);
    expect(JSON.stringify(payload)).not.toContain(post.marker);
  } finally {
    socket?.disconnect();
    await authorContext.dispose();
    await outsiderContext.dispose();
  }
});
