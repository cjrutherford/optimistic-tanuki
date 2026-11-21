import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DirectoryDeletionAction,
  DirectoryDeletionBlockedError,
  DirectoryDeletionResult,
} from './account-lifecycle';

const DELETION_ROUTE =
  /^\/internal\/account-deletion\/(fence|erase|readback|environment|purge-snapshots|runtime-readback)$/;
const EXPORT_ROUTE = /^\/internal\/account-export\/(open|read|release)$/;
const headers = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};
const BODY_LIMIT = 32 * 1024;

export type DirectoryDeletionExecutor = (
  grant: unknown,
  action: DirectoryDeletionAction
) => Promise<DirectoryDeletionResult>;

type Operation = (payload: unknown) => Promise<unknown>;
/**
 * The calls Authentication makes besides fence/erase/readback. Each validates
 * its own grant or lease with Authentication; an operation that is not supplied
 * is not routed (404), which Authentication treats as unavailable.
 */
export interface DirectoryAccountLifecycleOperations {
  environment?: Operation;
  purgeSnapshots?: Operation;
  runtimeReadback?: Operation;
  exportOpen?: Operation;
  exportRead?: Operation;
  exportRelease?: Operation;
}
const OPERATION_BY_ROUTE: Record<
  string,
  keyof DirectoryAccountLifecycleOperations
> = {
  environment: 'environment',
  'purge-snapshots': 'purgeSnapshots',
  'runtime-readback': 'runtimeReadback',
  open: 'exportOpen',
  read: 'exportRead',
  release: 'exportRelease',
};

/**
 * Internal routes for Authentication's deletion runner and export jobs,
 * mounted on both Directory HTTP servers only when a secret is configured.
 *
 * The bearer secret only authenticates the caller as an internal service; the
 * signed grant or lease, validated by Authentication on every call, is the
 * authority. Responses carry counts, statuses and export pages, never an
 * identifier in an error. Resolves false when the request is not for a route.
 */
export function createAccountLifecycleHandler(
  execute: DirectoryDeletionExecutor,
  secret: string,
  operations: DirectoryAccountLifecycleOperations = {}
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32)
    throw Error('Invalid account lifecycle secret');
  const expected = Buffer.from(secret);
  let active = 0;
  return async (req, res) => {
    const path = (req.url || '').split('?')[0];
    const deletion = path.match(DELETION_ROUTE);
    const exporting = deletion ? null : path.match(EXPORT_ROUTE);
    const route = deletion?.[1] ?? exporting?.[1];
    if (!route) return false;
    const mapped = OPERATION_BY_ROUTE[route];
    const operation = mapped ? operations[mapped] : undefined;
    if (mapped && !operation) return false;
    const send = (status: number, body?: object) => {
      res
        .writeHead(status, headers)
        .end(body ? JSON.stringify(body) : undefined);
      return true;
    };
    const header = req.headers.authorization;
    const provided = Buffer.from(
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : ''
    );
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      return send(401);
    if (req.method !== 'POST') return send(405);
    if (active >= 4) return send(503);
    active++;
    try {
      let body = Buffer.alloc(0);
      for await (const chunk of req) {
        body = Buffer.concat([body, Buffer.from(chunk)]);
        if (body.length > BODY_LIMIT) return send(413);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        return send(400);
      }
      try {
        if (operation) {
          const reply = await operation(payload);
          return send(200, reply && typeof reply === 'object' ? reply : {});
        }
        const result = await execute(payload, route as DirectoryDeletionAction);
        return send(200, {
          owner: 'directory',
          verified: result.verified,
          remaining: result.remaining,
          blocked: result.blocked,
        });
      } catch (error) {
        if (error instanceof DirectoryDeletionBlockedError)
          return send(409, {
            owner: 'directory',
            verified: false,
            status: 'blocked',
            remaining: error.report.remaining,
            blocked: error.report.blocked,
          });
        if (
          error instanceof Error &&
          error.message === 'DIRECTORY_DELETION_GRANT_INVALID'
        )
          return send(403);
        // Authority unavailable, scope changed, lock timeout, catalog drift: retryable and closed.
        return send(503);
      }
    } finally {
      active--;
    }
  };
}

export interface AccountLifecycleConfig {
  secret: string;
  authenticationHost: string;
  authenticationPort: number;
  profileHost: string;
  profilePort: number;
}

/**
 * Reads the lifecycle settings. Returns undefined, so the routes are not mounted
 * and Authentication sees Directory as unavailable, when no secret is set.
 * A secret that is present but unusable (short, non-printable, or equal to
 * another Directory secret) throws, so a misconfigured process does not start.
 */
export function accountLifecycleConfig(
  env: NodeJS.ProcessEnv,
  otherSecrets: Array<string | undefined> = []
): AccountLifecycleConfig | undefined {
  const secret = env['DIRECTORY_ACCOUNT_DELETION_SECRET'];
  if (!secret) return undefined;
  if (
    Buffer.byteLength(secret) < 32 ||
    /[^\x21-\x7e]/.test(secret) ||
    otherSecrets.includes(secret)
  )
    throw Error('Invalid account lifecycle secret');
  const port = (key: string, fallback: number) => {
    const value = Number(env[key] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535)
      throw Error(`${key} is invalid`);
    return value;
  };
  return {
    secret,
    authenticationHost:
      env['DIRECTORY_AUTHENTICATION_HOST'] || 'authentication',
    authenticationPort: port('DIRECTORY_AUTHENTICATION_PORT', 3001),
    profileHost: env['DIRECTORY_PROFILE_HOST'] || 'profile',
    profilePort: port('DIRECTORY_PROFILE_PORT', 3002),
  };
}
