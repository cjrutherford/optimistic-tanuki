import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import { MemoryCacheProvider } from '../../../gateway/src/auth/cache/memory-cache.provider';
import { PermissionsCacheService } from '../../../gateway/src/auth/permissions-cache.service';
import { withPermissionMutationInvalidation } from '../../../gateway/src/auth/permissions-mutation-client';
import { OAuthController } from '../../../gateway/src/controllers/oauth/oauth.controller';
import { RedisOAuthStateStore } from '../../../gateway/src/controllers/oauth/oauth-state.store';

if (
  process.env.N02_PRIVATE_MARKER !== 'private-n02-otts-v1' ||
  !process.send ||
  !['15081', '15082'].includes(process.env.N02_HTTP_PORT || '')
)
  throw new Error('PRIVATE_N02_WORKER_REQUIRED');
const auth = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 15001 },
});
const permissions = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 15012 },
});
const cache = new PermissionsCacheService(new MemoryCacheProvider(30000, 1000));
const mutations = withPermissionMutationInvalidation(permissions, cache);
const registry: any = {
  apps: [
    {
      appId: 'client-interface',
      uiBaseUrl: 'http://127.0.0.1:15080',
      apiBaseUrl: 'http://127.0.0.1:15084',
    },
    {
      appId: 'local-hub',
      uiBaseUrl: 'http://127.0.0.1:15083',
      apiBaseUrl: 'http://127.0.0.1:15084',
    },
  ],
};
const guard = new AuthGuard(
  auth,
  new Reflector(),
  new JwtService({ secret: process.env.N02_JWT_SECRET }),
  permissions,
  registry
);
const oauthStore = new RedisOAuthStateStore(
  process.env.REDIS_HOST || '127.0.0.1',
  Number(process.env.REDIS_PORT || 16382),
  process.env.REDIS_PASSWORD,
  Number(process.env.REDIS_DB || 0)
);
const oauth = Object.create(OAuthController.prototype) as OAuthController;
(oauth as any).authClient = auth;
(oauth as any).oauthStateStore = oauthStore;

function cookieMap(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of (header || '').split(';')) {
    const at = item.indexOf('=');
    if (at <= 0) continue;
    const key = item.slice(0, at).trim();
    const value = item.slice(at + 1).trim();
    if (/^[A-Za-z0-9_-]+$/.test(key) && value.length < 4096)
      result[key] = decodeURIComponent(value);
  }
  return result;
}
async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (Buffer.concat(chunks).length > 32768)
    throw new Error('N02_BODY_TOO_LARGE');
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
    : {};
}
function respond(
  res: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {}
) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(value));
}
async function guarded(req: IncomingMessage, appScope: string) {
  const request: any = {
    headers: req.headers,
    cookies: cookieMap(req.headers.cookie),
    user: undefined,
  };
  const context: any = {
    getHandler: () => guarded,
    getClass: () => Object,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  };
  await guard.canActivate(context);
  if (!request.user?.profileId) throw new Error('N02_AUTH_PROFILE_REQUIRED');
  return { request, appScope };
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/health')
      return respond(res, 200, { ready: true });
    if (req.method === 'POST' && url.pathname === '/permission') {
      const { request, appScope } = await guarded(
        req,
        String(url.searchParams.get('scope') || 'client-interface')
      );
      const permission = String(
        url.searchParams.get('permission') || 'n02-fixture'
      );
      const appScopeId = String(url.searchParams.get('scopeId') || '');
      const result = await cache.getOrLoad(
        request.user.profileId,
        permission,
        appScopeId,
        undefined,
        () =>
          firstValueFrom(
            permissions
              .send(
                { cmd: RoleCommands.CheckPermission },
                {
                  profileId: request.user.profileId,
                  permission,
                  appScopeId,
                  profileAppScope: appScope,
                }
              )
              .pipe(timeout({ first: 8000 }))
          )
      );
      return respond(res, result ? 200 : 403, { granted: result === true });
    }
    if (req.method === 'POST' && url.pathname === '/redeem') {
      const data = await body(req);
      const request: any = {
        headers: req.headers,
        cookies: cookieMap(req.headers.cookie),
      };
      let cookie = '';
      const response: any = {
        cookie: (name: string, value: string, options: any) => {
          cookie = `${name}=${encodeURIComponent(value)}; Path=${
            options.path
          }; HttpOnly; SameSite=Lax`;
        },
      };
      const value = await oauth.redeemCallbackCode(data, request, response);
      return respond(res, 200, value, cookie ? { 'set-cookie': cookie } : {});
    }
    if (req.method === 'POST' && url.pathname === '/logout') {
      const { request } = await guarded(req, 'client-interface');
      const token =
        request.cookies.ot_session ||
        String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      await firstValueFrom(
        auth
          .send({ cmd: AuthCommands.Logout }, { token })
          .pipe(timeout({ first: 8000 }))
      );
      return respond(res, 200, { loggedOut: true });
    }
    return respond(res, 404, { error: 'N02_NOT_FOUND' });
  } catch (error: any) {
    return respond(res, error.status || 401, {
      error: error.message || 'N02_REJECTED',
    });
  }
});

const active = new Map<string, Promise<void>>();
process.on('message', (message: any) => {
  if (message.op === 'stop') {
    void oauthStore.onModuleDestroy().finally(() => {
      auth.close();
      permissions.close();
      server.close();
      process.disconnect();
    });
    return;
  }
  const work = (async () => {
    try {
      let value: any;
      if (message.op === 'seed-cache') {
        for (const id of message.data.profileIds)
          await cache.set(
            id,
            message.data.permission,
            message.data.appScope,
            true
          );
        value = true;
      } else if (message.op === 'get-cache') {
        value = await cache.get(
          message.data.profileId,
          message.data.permission,
          message.data.appScope
        );
      } else if (message.op === 'consume-state') {
        value = (await oauthStore.consume(message.data.stateId)) ?? null;
      } else if (message.op === 'invalidate-profiles') {
        await cache.invalidateAccountProfiles(message.data.profileIds);
        value = true;
      } else if (message.op === 'role-mutate') {
        const { cmd, payload } = message.data;
        if (
          ![
            RoleCommands.Assign,
            RoleCommands.Unassign,
            RoleCommands.AddPermission,
            RoleCommands.RemovePermission,
          ].includes(cmd)
        )
          throw new Error('N02_MUTATION_NOT_ALLOWED');
        value = await firstValueFrom(
          mutations.send({ cmd }, payload).pipe(timeout({ first: 10000 }))
        );
      } else if (message.op === 'store-state') {
        await oauthStore.create(message.data.stateId, message.data.state);
        value = true;
      } else if (message.op === 'store-grant') {
        await oauthStore.createCallbackGrant(
          message.data.code,
          message.data.grant
        );
        value = true;
      } else if (message.op === 'invalidate-account') {
        await oauthStore.invalidateAccount(message.data.accountId);
        value = true;
      } else if (message.op === 'inspect-redis') {
        value = { ready: true, marker: randomUUID() };
      } else throw new Error('N02_UNKNOWN_IPC_OPERATION');
      process.send?.({ id: message.id, value });
    } catch (error: any) {
      process.send?.({
        id: message.id,
        error: error.message || 'N02_IPC_FAILED',
      });
    }
  })();
  active.set(message.id, work);
  void work.finally(() => active.delete(message.id));
});
async function start() {
  await Promise.all([auth.connect(), permissions.connect()]);
  const end = Date.now() + 10000;
  while (!(oauthStore as any).client?.isReady) {
    if (Date.now() >= end) throw new Error('N02_REDIS_CONNECT_TIMEOUT');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  server.listen(Number(process.env.N02_HTTP_PORT), '127.0.0.1', () =>
    process.send?.({ ready: true })
  );
}
void start().catch((error) => {
  process.send?.({ ready: false, error: error.message });
  process.exitCode = 1;
});
