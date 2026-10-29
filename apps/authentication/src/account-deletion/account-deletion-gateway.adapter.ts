import { Injectable } from '@nestjs/common';
import { validateDeletionGrantShape } from '@optimistic-tanuki/models';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';
import {
  DeletionNonOrmAdapter,
  DeletionNonOrmSubject,
} from './account-deletion-non-orm.service';

/** Explicit local deployment inventory; no inferred singleton or silent missing replica. */
export function deletionGatewayOrigins(
  raw: string | undefined
): readonly string[] {
  if (raw === undefined) return [];
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
  }
  if (!Array.isArray(values) || values.length < 1 || values.length > 8)
    throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
  const origins = values.map((value) => {
    if (typeof value !== 'string')
      throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol)
    )
      throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
    return url.origin;
  });
  if (new Set(origins).size !== origins.length)
    throw Error('DELETION_GATEWAY_INVENTORY_INVALID');
  return Object.freeze(origins);
}

@Injectable()
export class AccountDeletionGatewayAdapter implements DeletionNonOrmAdapter {
  readonly origins = deletionGatewayOrigins(
    process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS']
  );
  constructor(private readonly owner: AccountDeletionOwnerService) {}

  async purge(subject: DeletionNonOrmSubject): Promise<void> {
    await this.assertSubject(subject);
    await this.visit(subject, 'purge');
  }
  async readback(subject: DeletionNonOrmSubject): Promise<number> {
    await this.assertSubject(subject);
    await this.visit(subject, 'readback');
    await this.assertSubject(subject);
    return 0;
  }

  permissionAdapter(): DeletionNonOrmAdapter {
    return {
      purge: async (subject) => {
        await this.assertSubject(subject);
        await this.visit(subject, 'purge', ['permissions']);
      },
      readback: async (subject) => {
        await this.assertSubject(subject);
        await this.visit(subject, 'readback', ['permissions']);
        await this.assertSubject(subject);
        return 0;
      },
    };
  }

  runtimeAdapter(requireLogging = false): DeletionNonOrmAdapter {
    const check = async (
      subject: DeletionNonOrmSubject,
      action: 'purge' | 'readback'
    ) => {
      await this.assertSubject(subject);
      const replies = await this.visit(subject, action, ['runtime']);
      if (
        new Set(replies.map((reply) => reply.instanceId)).size !==
        this.origins.length
      )
        throw Error('DELETION_GATEWAY_REPLICA_ALIAS');
      if (
        requireLogging &&
        replies.some((reply) => reply.logging.active !== true)
      )
        throw Error('DELETION_GATEWAY_LOGGING_UNVERIFIED');
      await this.assertSubject(subject);
    };
    return {
      purge: (subject) => check(subject, 'purge'),
      readback: async (subject) => {
        await check(subject, 'readback');
        return 0;
      },
    };
  }

  private async assertSubject(subject: DeletionNonOrmSubject) {
    const grant = subject.grant;
    if (!this.origins.length)
      throw Error('DELETION_GATEWAY_INVENTORY_REQUIRED');
    if (
      !validateDeletionGrantShape(grant) ||
      grant.owner !== 'authentication' ||
      grant.action !== 'readback' ||
      grant.accountId !== subject.accountId ||
      grant.operationId !== subject.operationId
    )
      throw Error('DELETION_GATEWAY_GRANT_INVALID');
    const proof = await this.owner.readback(grant);
    if (
      proof?.complete !== true ||
      !Array.isArray(proof.unresolvedAttribution) ||
      proof.unresolvedAttribution.length
    )
      throw Error('DELETION_GATEWAY_OWNER_READBACK');
  }

  private async visit(
    subject: DeletionNonOrmSubject,
    action: 'purge' | 'readback',
    stores = ['oauth', 'sessions']
  ) {
    return Promise.all(
      this.origins.flatMap((origin) =>
        stores.map(async (store) => {
          const response = await fetch(
            `${origin}/api/internal/account-deletion/${store}/${action}`,
            {
              method: 'POST',
              redirect: 'error',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(subject.grant),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw Error('DELETION_GATEWAY_UNAVAILABLE');
          }
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              size += next.value.byteLength;
              if (size > 4096) throw Error('DELETION_GATEWAY_REPLY_BOUND');
              chunks.push(next.value);
            }
          } finally {
            await reader.cancel();
            reader.releaseLock();
          }
          let value: any;
          try {
            value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            throw Error('DELETION_GATEWAY_REPLY_INVALID');
          }
          if (
            !value ||
            Object.keys(value).sort().join(',') !==
              (store === 'runtime'
                ? 'fenced,instanceId,logging,remaining,store'
                : 'fenced,remaining,store') ||
            value.fenced !== true ||
            value.remaining !== 0 ||
            value.store !==
              (store === 'oauth'
                ? 'oauth-callback-state'
                : store === 'sessions'
                ? 'socket-sessions'
                : store === 'permissions'
                ? 'permission-caches'
                : 'gateway-runtime')
          )
            throw Error('DELETION_GATEWAY_REPLY_INVALID');
          if (
            store === 'runtime' &&
            (typeof value.instanceId !== 'string' ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
                value.instanceId
              ) ||
              value.logging?.policyVersion !== 1 ||
              typeof value.logging.active !== 'boolean')
          )
            throw Error('DELETION_GATEWAY_REPLY_INVALID');
          return value;
        })
      )
    );
  }
}
