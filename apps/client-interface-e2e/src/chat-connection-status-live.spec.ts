import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { parse } from 'dotenv';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const enabled = process.env['CHAT_CONNECTION_LIVE_STACK'] === 'true';
const root = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const fixturePath = resolve(
  root,
  '.runtime-artifacts/local-dev/otts-review-fixtures.json'
);
const trackingDir = resolve(root, '.runtime-artifacts/chat-status');
type App = {
  name: string;
  origin: string;
  scope: 'client-interface' | 'local-hub';
  city: boolean;
};
const apps: App[] = [
  {
    name: 'OT',
    origin:
      process.env['CHAT_CONNECTION_OT_ORIGIN'] ?? 'http://localhost:18080',
    scope: 'client-interface',
    city: false,
  },
  {
    name: 'TS',
    origin: process.env['CHAT_CONNECTION_TS_ORIGIN'] ?? 'http://localhost:8087',
    scope: 'local-hub',
    city: true,
  },
];

function headers(app: App) {
  return {
    Origin: new URL(app.origin).origin,
    'x-ot-app-id': app.scope,
    'x-ot-appscope': app.scope,
    'x-ot-session-mode': 'cookie',
  };
}

// Gateway session responses use { data: ... }; other routes may return the DTO directly.
async function body<T>(response: APIResponse): Promise<T> {
  const value = await response.json();
  return (
    value && typeof value === 'object' && 'data' in value ? value.data : value
  ) as T;
}

async function login(page: Page, app: App, key: 'OWNER' | 'MEMBER') {
  const values = parse(readFileSync(resolve(root, '.env')));
  const email = values[`OT_TS_REVIEW_${key}_EMAIL`];
  const password = values[`OT_TS_REVIEW_${key}_PASSWORD`];
  if (!email || !password)
    throw new Error(
      `Missing synthetic ${key.toLowerCase()} credentials in .env`
    );
  await page.goto(new URL('/login', app.origin).toString());
  const form = page.locator('lib-login-block form');
  await expect(form).toBeVisible();
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Password', { exact: true }).fill(password);
  await form.getByRole('button', { name: /^login$/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 30_000 });
  const sessionResponse = await page.request.get(
    `${app.origin}/api/authentication/session`,
    { headers: headers(app) }
  );
  expect(sessionResponse.status(), 'cookie session is authenticated').toBe(200);
  const session = await body<{ userId: string; profileId: string }>(
    sessionResponse
  );
  expect(session.userId).toEqual(expect.any(String));
  expect(session.profileId).toEqual(expect.any(String));
  return session;
}

async function openConversation(page: Page, app: App, name: string) {
  await page.goto(`${app.origin}/messages`);
  const contact = page
    .locator('.messenger-sidebar .contact-item')
    .filter({ hasText: name });
  await expect(contact).toBeVisible({ timeout: 30_000 });
  await contact.click();
  const window = page.locator('.messenger-main lib-chat-window');
  await expect(window).toBeVisible();
  await expect(window.locator('.contact-name')).toContainText(name);
  const status = window.locator('.chat-window-header .contact-status');
  await expect(status).toHaveText(/Connected/, { timeout: 30_000 });
  await expect(status).not.toContainText(/\b(?:Online|Offline)\b/);
  return status;
}

test.describe('live community chat connection status', () => {
  test.skip(!enabled, 'Set CHAT_CONNECTION_LIVE_STACK=true for the live stack');
  test.setTimeout(150_000);

  for (const app of apps) {
    test(`${app.name}: single viewer and two viewers see connection and recovery`, async ({
      browser,
    }) => {
      const ownerContext = await browser.newContext({ baseURL: app.origin });
      const memberContext = await browser.newContext({ baseURL: app.origin });
      try {
        // Keep the real WebSockets: recording their handles lets this test
        // close the transport, which HTTP offline emulation alone may not do.
        await ownerContext.addInitScript(() => {
          const sockets: WebSocket[] = [];
          (
            window as Window & { __chatConnectionSockets?: WebSocket[] }
          ).__chatConnectionSockets = sockets;
          const NativeWebSocket = window.WebSocket;
          window.WebSocket = class extends NativeWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
              super(url, protocols);
              if (new URL(String(url)).pathname.startsWith('/socket.io')) {
                sockets.push(this);
              }
            }
          };
        });
        const owner = await ownerContext.newPage();
        const member = await memberContext.newPage();
        const ownerSession = await login(owner, app, 'OWNER');
        const marker = randomUUID();
        const name = `Synthetic chat status ${app.name} ${marker}`;
        const parentId = app.city
          ? (
              JSON.parse(readFileSync(fixturePath, 'utf8')) as {
                cityId?: string;
              }
            ).cityId
          : undefined;
        if (app.city)
          expect(parentId, 'existing synthetic TS city').toEqual(
            expect.any(String)
          );
        const created = await owner.request.post(
          `${app.origin}/api/social/community`,
          {
            headers: headers(app),
            data: {
              name,
              slug: `synthetic-chat-status-${marker}`,
              description: 'Synthetic connection status test fixture',
              isPrivate: false,
              joinPolicy: 'public',
              createChatRoom: true,
              ...(parentId ? { parentId } : {}),
            },
          }
        );
        expect(created.status(), 'create scoped synthetic community').toBe(201);
        const community = await body<{ id: string; name: string }>(created);
        expect(community.id).toEqual(expect.any(String));
        // Record immediately, including on later assertion failures; never store credentials.
        mkdirSync(trackingDir, { recursive: true, mode: 0o700 });
        appendFileSync(
          resolve(trackingDir, 'fixtures.jsonl'),
          JSON.stringify({
            app: app.name,
            origin: app.origin,
            scope: app.scope,
            communityId: community.id,
            name,
            ownerProfileId: ownerSession.profileId,
            createdAt: new Date().toISOString(),
          }) + '\n',
          { mode: 0o600 }
        );
        const roomResponse = await owner.request.get(
          `${app.origin}/api/social/community/${community.id}/chat-room`,
          { headers: headers(app) }
        );
        expect(roomResponse.status(), 'community chat room').toBe(200);
        const room = await body<{ id: string }>(roomResponse);
        expect(room?.id).toEqual(expect.any(String));
        appendFileSync(
          resolve(trackingDir, 'fixtures.jsonl'),
          JSON.stringify({
            app: app.name,
            communityId: community.id,
            roomId: room.id,
          }) + '\n',
          { mode: 0o600 }
        );

        // No member has joined or opened the conversation at this point.
        const ownerStatus = await openConversation(owner, app, name);
        await expect(ownerStatus).toContainText('Connected');
        const memberSession = await login(member, app, 'MEMBER');
        expect(memberSession.profileId).not.toBe(ownerSession.profileId);
        const joined = await member.request.post(
          `${app.origin}/api/social/community/${community.id}/join`,
          { headers: headers(app), data: {} }
        );
        expect(joined.status(), 'join public community').toBe(201);
        const membership = await body<{ id: string; status: string }>(joined);
        appendFileSync(
          resolve(trackingDir, 'fixtures.jsonl'),
          JSON.stringify({
            app: app.name,
            communityId: community.id,
            membershipId: membership.id,
          }) + '\n',
          { mode: 0o600 }
        );
        expect(membership.status).toBe('approved');
        // Membership is authoritative for community chats; stored participants can lag.
        await expect
          .poll(
            async () => {
              const response = await member.request.get(
                `${app.origin}/api/chat/conversations/find`,
                { headers: headers(app) }
              );
              if (!response.ok()) return false;
              const conversations = await body<
                Array<{ id: string; type: string }>
              >(response);
              return (
                Array.isArray(conversations) &&
                conversations.some(
                  (c) => c.id === room.id && c.type === 'community'
                )
              );
            },
            { timeout: 30_000 }
          )
          .toBe(true);
        const memberStatus = await openConversation(member, app, name);
        await expect(ownerStatus).toHaveText(/Connected/);
        await expect(memberStatus).toHaveText(/Connected/);
        await owner.locator('.chat-window-header').screenshot({
          path: resolve(
            trackingDir,
            `${app.name.toLowerCase()}-connected-desktop.png`
          ),
          animations: 'disabled',
        });
        await owner.setViewportSize({ width: 390, height: 844 });
        await expect(ownerStatus).toHaveText(/Connected/);
        await owner.locator('.chat-window-header').screenshot({
          path: resolve(
            trackingDir,
            `${app.name.toLowerCase()}-connected-mobile.png`
          ),
          animations: 'disabled',
        });
        await expect
          .poll(() =>
            owner.evaluate(() =>
              (
                window as Window & { __chatConnectionSockets?: WebSocket[] }
              ).__chatConnectionSockets?.some(
                (socket) => socket.readyState === WebSocket.OPEN
              )
            )
          )
          .toBe(true);
        await ownerContext.setOffline(true);
        const closed = await owner.evaluate(() => {
          const sockets =
            (window as Window & { __chatConnectionSockets?: WebSocket[] })
              .__chatConnectionSockets ?? [];
          const open = sockets.filter(
            (socket) => socket.readyState === WebSocket.OPEN
          );
          open.forEach((socket) =>
            socket.close(4000, 'Chat connection regression')
          );
          return open.length;
        });
        expect(closed, 'close an established real transport').toBeGreaterThan(
          0
        );
        await expect(ownerStatus).not.toContainText('Connected', {
          timeout: 30_000,
        });
        await expect(memberStatus).toHaveText(/Connected/);
        await ownerContext.setOffline(false);
        await expect(ownerStatus).toHaveText(/Connected/, { timeout: 30_000 });
        await expect(ownerStatus).not.toContainText(/\b(?:Online|Offline)\b/);
      } finally {
        await Promise.all([ownerContext.close(), memberContext.close()]);
      }
    });
  }
});
