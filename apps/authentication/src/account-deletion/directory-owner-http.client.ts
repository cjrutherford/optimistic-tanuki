import { Inject, Injectable, Optional } from '@nestjs/common';

export const DIRECTORY_OWNER_HTTP_OPTIONS = Symbol(
  'DIRECTORY_OWNER_HTTP_OPTIONS'
);
export interface DirectoryOwnerHttpOptions {
  /** Origin of Directory's internal HTTP server, e.g. http://directory:3120. */
  baseUrl?: string;
  /** Bearer secret shared with Directory; at least 32 bytes. */
  secret?: string;
  fetch?: typeof fetch;
}
export type DirectoryDeletionAction = 'fence' | 'erase' | 'readback';
export interface DirectoryDeletionReply {
  verified: boolean;
  remaining: number;
  blocked: number;
}
/** Directory refused to erase because a matched row's identity domain is unknown. */
export class DirectoryOwnerBlockedError extends Error {
  constructor(readonly remaining: number, readonly blocked: number) {
    super('DELETION_DIRECTORY_BLOCKED');
  }
}

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

/**
 * Directory is a plain HTTP service, so it is the one account lifecycle owner
 * Authentication reaches over HTTP instead of Nest TCP. The bearer secret only
 * authenticates this caller; Directory re-validates every signed grant and
 * export lease with Authentication before acting.
 *
 * Unconfigured (both settings absent) is allowed at startup and makes every
 * call fail, which blocks deletion and export instead of skipping Directory.
 */
@Injectable()
export class DirectoryOwnerHttpClient {
  private readonly base?: URL;
  private readonly secret?: string;
  private readonly fetcher: typeof fetch;

  constructor(
    @Optional()
    @Inject(DIRECTORY_OWNER_HTTP_OPTIONS)
    options?: DirectoryOwnerHttpOptions
  ) {
    const baseUrl =
      options?.baseUrl ??
      (options ? undefined : process.env['DIRECTORY_ACCOUNT_LIFECYCLE_URL']);
    const secret =
      options?.secret ??
      (options ? undefined : process.env['DIRECTORY_ACCOUNT_LIFECYCLE_SECRET']);
    this.fetcher = options?.fetch ?? ((input, init) => fetch(input, init));
    if (!baseUrl && !secret) return;
    let url: URL | undefined;
    try {
      url = new URL(baseUrl ?? '');
    } catch {
      /* rejected below */
    }
    if (
      !url ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      typeof secret !== 'string' ||
      Buffer.byteLength(secret) < 32 ||
      /[^\x21-\x7e]/.test(secret)
    )
      throw Error('DIRECTORY_ACCOUNT_LIFECYCLE_CONFIG_INVALID');
    this.base = url;
    this.secret = secret;
  }

  get configured(): boolean {
    return Boolean(this.base);
  }

  /** Fence, erase or readback. A blocked reply always throws; it is never a result. */
  async deletion(
    action: DirectoryDeletionAction,
    grant: unknown
  ): Promise<DirectoryDeletionReply> {
    if (!['fence', 'erase', 'readback'].includes(action))
      throw Error('DELETION_OWNER_ACTION_INVALID');
    const { status, body } = await this.post(
      `/internal/account-deletion/${action}`,
      grant,
      20000
    );
    const keys = record(body) ? Object.keys(body).sort().join(',') : '';
    if (
      status === 409 &&
      record(body) &&
      keys === 'blocked,owner,remaining,status,verified' &&
      body['owner'] === 'directory' &&
      body['status'] === 'blocked' &&
      body['verified'] === false &&
      count(body['remaining']) &&
      count(body['blocked'])
    )
      throw new DirectoryOwnerBlockedError(body['remaining'], body['blocked']);
    if (
      status !== 200 ||
      !record(body) ||
      keys !== 'blocked,owner,remaining,verified' ||
      body['owner'] !== 'directory' ||
      typeof body['verified'] !== 'boolean' ||
      !count(body['remaining']) ||
      !count(body['blocked'])
    )
      throw Error('DELETION_DIRECTORY_UNAVAILABLE');
    return {
      verified: body['verified'],
      remaining: body['remaining'],
      blocked: body['blocked'],
    };
  }

  environment(grant: unknown): Promise<unknown> {
    return this.ok('/internal/account-deletion/environment', grant, 10000);
  }
  purgeSnapshots(grant: unknown): Promise<unknown> {
    return this.ok('/internal/account-deletion/purge-snapshots', grant, 60000);
  }
  runtimeReadback(grant: unknown): Promise<unknown> {
    return this.ok('/internal/account-deletion/runtime-readback', grant, 60000);
  }
  exportCapture(
    operation: 'open' | 'read' | 'release',
    payload: unknown,
    timeoutMs: number
  ): Promise<unknown> {
    if (!['open', 'read', 'release'].includes(operation))
      throw Error('DIRECTORY_EXPORT_OPERATION_INVALID');
    return this.ok(`/internal/account-export/${operation}`, payload, timeoutMs);
  }

  private async ok(
    path: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<unknown> {
    const { status, body } = await this.post(path, payload, timeoutMs);
    if (status !== 200 || !record(body))
      throw Error('DELETION_DIRECTORY_UNAVAILABLE');
    return body;
  }

  private async post(
    path: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<{ status: number; body: unknown }> {
    if (!this.base || !this.secret)
      throw Error('DELETION_OWNER_ENDPOINT_REQUIRED');
    let text: string;
    let status: number;
    try {
      const response = await this.fetcher(new URL(path, this.base), {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${this.secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      const bytes = Buffer.from(await response.arrayBuffer());
      // A read page is at most 64 KiB of base64 data plus a small envelope.
      if (bytes.length > 512 * 1024) throw Error();
      text = bytes.toString('utf8');
    } catch {
      // Never surface the URL, the secret or a transport message.
      throw Error('DELETION_DIRECTORY_UNAVAILABLE');
    }
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw Error('DELETION_DIRECTORY_UNAVAILABLE');
    }
    return { status, body };
  }
}
