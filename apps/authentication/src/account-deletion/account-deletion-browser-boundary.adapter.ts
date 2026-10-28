import { Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { ACCOUNT_DELETION_BROWSER_BOUNDARY } from '@optimistic-tanuki/models';
import { AccountDeletionGatewayAdapter } from './account-deletion-gateway.adapter';
import {
  DeletionNonOrmAdapter,
  DeletionNonOrmSubject,
} from './account-deletion-non-orm.service';

export function deletionBrowserOrigins(
  raw: string | undefined
): readonly string[] {
  if (raw === undefined) return [];
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error('DELETION_BROWSER_INVENTORY_INVALID');
  }
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'client-interface,local-hub'
  )
    throw Error('DELETION_BROWSER_INVENTORY_INVALID');
  const origins: string[] = [];
  for (const app of ACCOUNT_DELETION_BROWSER_BOUNDARY.applications) {
    const values = value[app];
    if (!Array.isArray(values) || !values.length || values.length > 8)
      throw Error('DELETION_BROWSER_INVENTORY_INVALID');
    for (const entry of values) {
      let url: URL;
      try {
        if (typeof entry !== 'string') throw Error();
        url = new URL(entry);
      } catch {
        throw Error('DELETION_BROWSER_INVENTORY_INVALID');
      }
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/' ||
        !(
          url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        )
      )
        throw Error('DELETION_BROWSER_INVENTORY_INVALID');
      origins.push(url.origin);
    }
  }
  if (new Set(origins).size !== origins.length)
    throw Error('DELETION_BROWSER_INVENTORY_INVALID');
  return Object.freeze(origins);
}
/** N06 disposition: enforce session-boundary reset in the declared built clients.
 * Count is server-held browser-session bindings, not arbitrary offline device bytes. */
@Injectable()
export class AccountDeletionBrowserBoundaryAdapter
  implements DeletionNonOrmAdapter
{
  readonly verificationMode = 'session-boundary' as const;
  readonly origins = deletionBrowserOrigins(
    process.env['ACCOUNT_DELETION_BROWSER_ORIGINS']
  );
  constructor(private readonly gateway: AccountDeletionGatewayAdapter) {}
  async purge(subject: DeletionNonOrmSubject): Promise<void> {
    await this.boundaries();
    await this.gateway.purge(subject);
  }
  async readback(subject: DeletionNonOrmSubject): Promise<number> {
    await this.boundaries();
    return this.gateway.readback(subject);
  }
  private async boundaries(): Promise<void> {
    if (!this.origins.length)
      throw Error('DELETION_BROWSER_INVENTORY_REQUIRED');
    await Promise.all(
      this.origins.map(async (origin) => {
        const response = await fetch(
          origin + '/assets/browser-session-boundary.json',
          { redirect: 'error', signal: AbortSignal.timeout(5000) }
        );
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw Error('DELETION_BROWSER_BOUNDARY_UNAVAILABLE');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > 4096) throw Error('DELETION_BROWSER_BOUNDARY_INVALID');
            chunks.push(next.value);
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
        let value: unknown;
        try {
          value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          throw Error('DELETION_BROWSER_BOUNDARY_INVALID');
        }
        if (!isDeepStrictEqual(value, ACCOUNT_DELETION_BROWSER_BOUNDARY))
          throw Error('DELETION_BROWSER_BOUNDARY_INVALID');
      })
    );
  }
}
