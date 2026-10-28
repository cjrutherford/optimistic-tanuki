import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { parse } from 'dotenv';
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const enabled = process.env['CHAT_SEND_LIVE_STACK'] === 'true';
const root = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const trackingDir = resolve(root, '.runtime-artifacts/chat-send');
type App = { name: string; origin: string; scope: string; city: boolean };
const apps: App[] = [
  {
    name: 'OT',
    origin: 'http://localhost:18080',
    scope: 'client-interface',
    city: false,
  },
  {
    name: 'TS',
    origin: 'http://localhost:8087',
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
async function body<T>(response: APIResponse): Promise<T> {
  const value = await response.json();
  return (
    value && typeof value === 'object' && 'data' in value ? value.data : value
  ) as T;
}
function track(value: object) {
  mkdirSync(trackingDir, { recursive: true, mode: 0o700 });
  const file = resolve(trackingDir, 'fixtures.jsonl');
  appendFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
}
async function login(page: Page, app: App, role: 'OWNER' | 'MEMBER') {
  const values = parse(readFileSync(resolve(root, '.env')));
  const email = values[`OT_TS_REVIEW_${role}_EMAIL`];
  const password = values[`OT_TS_REVIEW_${role}_PASSWORD`];
  if (!email || !password)
    throw new Error(`Missing synthetic ${role.toLowerCase()} credentials`);
  await page.goto(`${app.origin}/login`);
  const form = page.locator('lib-login-block form');
  await expect(form).toBeVisible();
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Password', { exact: true }).fill(password);
  await form.getByRole('button', { name: /^login$/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 30_000 });
  const response = await page.request.get(
    `${app.origin}/api/authentication/session`,
    { headers: headers(app) }
  );
  expect(response.status()).toBe(200);
  const session = await body<{ userId: string; profileId: string }>(response);
  expect(session.profileId).toEqual(expect.any(String));
  return session;
}
async function profileName(page: Page, app: App, profileId: string) {
  const response = await page.request.get(
    `${app.origin}/api/profile/by-id/${encodeURIComponent(profileId)}`,
    { headers: headers(app) }
  );
  expect(response.status(), 'lookup synthetic session profile').toBe(200);
  const profile = await body<{ id: string; profileName?: string }>(response);
  expect(profile.id).toBe(profileId);
  expect(profile.profileName?.trim()).toBeTruthy();
  expect(profile.profileName).not.toBe('Unknown');
  return profile.profileName!.trim();
}
async function openChat(page: Page, app: App, slug: string) {
  await page.goto(
    `${app.origin}${app.city ? `/c/${slug}` : `/communities/${slug}/chat`}`
  );
  if (app.city)
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
  const chat = page.locator('lib-community-chat');
  await expect(chat.locator('.contact-status')).toHaveText(/Connected/, {
    timeout: 30_000,
  });
  await expect(chat.getByPlaceholder('Type a message...')).toBeVisible();
  return chat;
}

test.describe('live community chat sends', () => {
  test.skip(!enabled, 'Set CHAT_SEND_LIVE_STACK=true for the live stack');
  test.setTimeout(150_000);
  for (const app of apps) {
    test(`${app.name}: approved members exchange and persist messages`, async ({
      browser,
    }) => {
      const ownerContext = await browser.newContext({ baseURL: app.origin });
      const memberContext = await browser.newContext({ baseURL: app.origin });
      try {
        const owner = await ownerContext.newPage();
        const member = await memberContext.newPage();
        const ownerSession = await login(owner, app, 'OWNER');
        const memberSession = await login(member, app, 'MEMBER');
        expect(memberSession.profileId).not.toBe(ownerSession.profileId);
        const ownerName = await profileName(owner, app, ownerSession.profileId);
        const memberName = await profileName(
          member,
          app,
          memberSession.profileId
        );
        const marker = randomUUID();
        const slug = `synthetic-chat-send-${marker}`;
        const parentId = app.city
          ? (
              JSON.parse(
                readFileSync(
                  resolve(
                    root,
                    '.runtime-artifacts/local-dev/otts-review-fixtures.json'
                  ),
                  'utf8'
                )
              ) as { cityId?: string }
            ).cityId
          : undefined;
        if (app.city)
          expect(parentId, 'synthetic TS city').toEqual(expect.any(String));
        const created = await owner.request.post(
          `${app.origin}/api/social/community`,
          {
            headers: headers(app),
            data: {
              name: `Synthetic chat send ${app.name} ${marker}`,
              slug,
              description: 'Synthetic live chat send fixture',
              isPrivate: false,
              joinPolicy: 'public',
              createChatRoom: true,
              ...(parentId ? { parentId } : {}),
            },
          }
        );
        expect(created.status(), 'create synthetic community').toBe(201);
        const community = await body<{ id: string }>(created);
        expect(community.id).toEqual(expect.any(String));
        track({
          app: app.name,
          communityId: community.id,
          slug,
          ownerProfileId: ownerSession.profileId,
          createdAt: new Date().toISOString(),
        });
        const roomUrl = `${app.origin}/api/social/community/${community.id}/chat-room`;
        const ownerRoom = await owner.request.get(roomUrl, {
          headers: headers(app),
        });
        expect(ownerRoom.status()).toBe(200);
        const room = await body<{ id: string }>(ownerRoom);
        expect(room.id).toEqual(expect.any(String));
        track({ app: app.name, communityId: community.id, roomId: room.id });
        expect(
          (
            await member.request.get(roomUrl, { headers: headers(app) })
          ).status(),
          'nonmember room privacy'
        ).toBe(403);
        const joined = await member.request.post(
          `${app.origin}/api/social/community/${community.id}/join`,
          { headers: headers(app), data: {} }
        );
        expect(joined.status()).toBe(201);
        const membership = await body<{ id: string; status: string }>(joined);
        track({
          app: app.name,
          communityId: community.id,
          membershipId: membership.id,
        });
        expect(membership.status).toBe('approved');
        const memberRoom = await member.request.get(roomUrl, {
          headers: headers(app),
        });
        expect(memberRoom.status()).toBe(200);
        expect((await body<{ id: string }>(memberRoom)).id).toBe(room.id);
        const ownerChat = await openChat(owner, app, slug);
        const memberChat = await openChat(member, app, slug);
        const ownerText = `Synthetic owner send ${marker}`;
        const memberText = `Synthetic member reply ${marker}`;
        for (const [sender, receiver, content, expectedName] of [
          [ownerChat, memberChat, ownerText, ownerName],
          [memberChat, ownerChat, memberText, memberName],
        ] as const) {
          const draft = sender.getByPlaceholder('Type a message...');
          await draft.fill(content);
          await sender.locator('otui-button.send-button button').click();
          await expect(draft).toHaveValue('', { timeout: 30_000 });
          await expect(sender.locator('.compose-error')).toHaveCount(0);
          await expect(
            receiver
              .locator('.message-text')
              .getByText(content, { exact: true })
          ).toBeVisible({ timeout: 30_000 });
          for (const chat of [sender, receiver]) {
            const message = chat
              .locator('.message')
              .filter({ hasText: content });
            await expect(message.locator('.message-sender-name')).toHaveText(
              expectedName,
              { timeout: 30_000 }
            );
          }
        }
        await expect
          .poll(
            async () => {
              const response = await owner.request.get(
                `${app.origin}/api/chat/messages/${room.id}`,
                { headers: headers(app) }
              );
              if (response.status() !== 200) return false;
              const messages = await body<
                Array<{ content: string; senderId: string }>
              >(response);
              return (
                Array.isArray(messages) &&
                messages.some(
                  (m) =>
                    m.content === ownerText &&
                    m.senderId === ownerSession.profileId
                ) &&
                messages.some(
                  (m) =>
                    m.content === memberText &&
                    m.senderId === memberSession.profileId
                )
              );
            },
            {
              message: 'both messages persist with session profile senders',
              timeout: 30_000,
            }
          )
          .toBe(true);
        await owner.reload();
        await member.reload();
        const ownerHistory = await openChat(owner, app, slug);
        const memberHistory = await openChat(member, app, slug);
        for (const [chat, content, expectedName] of [
          [ownerHistory, ownerText, ownerName],
          [ownerHistory, memberText, memberName],
          [memberHistory, ownerText, ownerName],
          [memberHistory, memberText, memberName],
        ] as const) {
          const message = chat.locator('.message').filter({ hasText: content });
          await expect(message.locator('.message-text')).toBeVisible({
            timeout: 30_000,
          });
          await expect(message.locator('.message-sender-name')).toHaveText(
            expectedName,
            { timeout: 30_000 }
          );
        }
        await expect(ownerHistory.locator('.contact-status')).toHaveText(
          /Connected/
        );
        await expect(memberHistory.locator('.contact-status')).toHaveText(
          /Connected/
        );
      } finally {
        await ownerContext.close();
        await memberContext.close();
      }
    });
  }
});
