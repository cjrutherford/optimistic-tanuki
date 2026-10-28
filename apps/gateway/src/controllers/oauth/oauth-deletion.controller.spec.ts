import { CommunityInviteMailer } from '../social/community/community-invite.mailer';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { MemoryCacheProvider } from '../../auth/cache/memory-cache.provider';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import {
  OAuthDeletionController,
  SocketSessionDeletionController,
  PermissionCacheDeletionController,
  GatewayRuntimeDeletionController,
} from './oauth-deletion.controller';
import { LocalOAuthStateStore, OAUTH_STATE_STORE } from './oauth-state.store';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

const grant = {
  contractVersion: 1,
  accountId: randomUUID(),
  operationId: randomUUID(),
  appId: 'client-interface',
  owner: 'authentication',
  action: 'readback',
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  signature: 'a'.repeat(64),
};
const scope = { currentProfileIds: [randomUUID()], legacyProfileIds: [] };

describe('D25 OAuth deletion capability HTTP boundary', () => {
  let app: INestApplication;
  let store: LocalOAuthStateStore;
  let send: jest.Mock;
  let cache: PermissionsCacheService;
  beforeEach(async () => {
    store = new LocalOAuthStateStore();
    cache = new PermissionsCacheService(new MemoryCacheProvider());
    send = jest.fn(() =>
      of({ valid: true, accountId: grant.accountId, scope })
    );
    const module = await Test.createTestingModule({
      controllers: [
        OAuthDeletionController,
        SocketSessionDeletionController,
        PermissionCacheDeletionController,
        GatewayRuntimeDeletionController,
      ],
      providers: [
        {
          provide: CommunityInviteMailer,
          useValue: new CommunityInviteMailer(),
        },
        { provide: PermissionsCacheService, useValue: cache },
        {
          provide: SocketSessionAuthService,
          useValue: new SocketSessionAuthService(
            {} as never,
            {} as never,
            { apps: [] } as never
          ),
        },
        { provide: OAUTH_STATE_STORE, useValue: store },
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: { send } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app.close();
  });
  const path = '/api/internal/account-deletion/oauth/';
  async function post(action: string, body: unknown, status: number) {
    const address = app.getHttpServer().address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}${action}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'ot_session=not-authority',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }
    );
    expect(response.status).toBe(status);
    return { body: await response.json() };
  }
  it('drains the local email runtime with a fresh capability and reports a process identity', async () => {
    await post('../runtime/readback', grant, 403);
    const result = (await post('../runtime/purge', grant, 201)).body;
    expect(result).toMatchObject({
      store: 'gateway-runtime',
      remaining: 0,
      fenced: true,
      logging: { policyVersion: 1 },
    });
    expect(result.instanceId).toMatch(/^[0-9a-f-]{36}$/);
    await post('../runtime/readback', { ...grant, action: 'fence' }, 403);
  });
  it('purges only authoritative profile cache entries through the signed endpoint', async () => {
    const foreign = randomUUID();
    await cache.set(scope.currentProfileIds[0], 'read', 'local-hub', true);
    await cache.set(foreign, 'read', 'local-hub', true);
    await post('../permissions/readback', grant, 403);
    expect((await post('../permissions/purge', grant, 201)).body).toEqual({
      store: 'permission-caches',
      remaining: 0,
      fenced: true,
    });
    await post('../permissions/readback', grant, 201);
    expect(await cache.get(foreign, 'read', 'local-hub')).toBe(true);
    await post('../permissions/purge', { ...grant, owner: 'social' }, 403);
  });
  it('provides the same signed boundary for socket purge and refuses unproved readback', async () => {
    const pathSuffix = '../sessions/';
    await post(pathSuffix + 'readback', grant, 403);
    expect((await post(pathSuffix + 'purge', grant, 201)).body).toEqual({
      store: 'socket-sessions',
      remaining: 0,
      fenced: true,
    });
    await post(pathSuffix + 'readback', grant, 201);
    await post(pathSuffix + 'purge', { ...grant, owner: 'social' }, 403);
  });
  it('requires exact authority capability, not an account selector or user cookie', async () => {
    const purge = jest.spyOn(store, 'purgeAccount');
    for (const body of [
      {},
      { accountId: grant.accountId },
      { ...grant, owner: 'social' },
      { ...grant, action: 'erase' },
      { ...grant, appId: 'other-product' },
      { ...grant, profileIds: [] },
    ]) {
      await post('purge', body, 403);
    }
    expect(purge).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it('runs account purge and independent readback, then revalidates scope and current lease', async () => {
    await store.create('link', {
      payload: {
        provider: 'google',
        returnTo: 'https://ot.example.test',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        codeVerifier: 'private-pkce',
        linkUserId: grant.accountId,
      },
      nonceHash: 'private-nonce',
      expiresAt: Date.now() + 60000,
    });
    const response = await post('purge', grant, 201);
    expect(response.body).toEqual({
      store: 'oauth-callback-state',
      remaining: 0,
      fenced: true,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await store.consume('link')).toBeUndefined();
    await post('readback', grant, 201);
    expect(send).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(response.body)).not.toContain(grant.accountId);
  });
  it('denies stale or forged capabilities before any local mutation', async () => {
    send.mockReturnValue(throwError(() => Error('PRIVATE_AUTH_ERROR')));
    const purge = jest.spyOn(store, 'purgeAccount');
    const response = await post('purge', grant, 403);
    expect(purge).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_AUTH_ERROR');
  });
  it('cannot report success on readback without a fence or after scope changes', async () => {
    await post('readback', grant, 403);
    send
      .mockReturnValueOnce(
        of({ valid: true, accountId: grant.accountId, scope })
      )
      .mockReturnValueOnce(
        of({
          valid: true,
          accountId: grant.accountId,
          scope: { currentProfileIds: [], legacyProfileIds: [] },
        })
      );
    await post('purge', grant, 403);
    expect(await store.readbackAccount(grant.accountId)).toBe(0);
  });
});
