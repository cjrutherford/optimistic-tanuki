import { randomUUID } from 'node:crypto';
import {
  payloadFreeLoggingStatus,
  databaseLoggingStatus,
} from '@optimistic-tanuki/logger';
import type { AccountExportOwnerSpoolService } from './account-export-owner-spool.service';
import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AccountDeletionOwner,
  validateDeletionGrantShape,
  ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND,
  ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND,
  ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND,
  ACCOUNT_DELETION_ENVIRONMENT_COMMAND,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from './account-deletion-authority.client';
export const ACCOUNT_DELETION_SNAPSHOT_OPTIONS = Symbol(
  'ACCOUNT_DELETION_SNAPSHOT_OPTIONS'
);
export interface AccountDeletionSnapshotOptions {
  scopeReadback?: (
    accountId: string,
    profileIds: readonly string[] | null
  ) => Promise<number>;
  database?: { query(sql: string): Promise<unknown> };
  custodyProbe?: (
    nonce: string,
    mode: 'write' | 'read' | 'remove'
  ) => Promise<string>;
  owner: AccountDeletionOwner;
  snapshot: { purgeAccount(accountId: string): Promise<{ remaining: 0 }> };
  authority: AccountDeletionAuthorityClient;
  audit?: {
    readbackParticipation(subject: {
      accountId: string;
      profileIds: readonly string[];
    }): Promise<number>;
  };
  spool: Pick<
    AccountExportOwnerSpoolService,
    'purgeAccount' | 'readbackAccount'
  >;
}
@Controller()
export class AccountDeletionSnapshotController {
  private readonly instanceId = randomUUID();
  constructor(
    @Inject(ACCOUNT_DELETION_SNAPSHOT_OPTIONS)
    private readonly options: AccountDeletionSnapshotOptions
  ) {}
  @MessagePattern({ cmd: ACCOUNT_DELETION_ENVIRONMENT_COMMAND })
  async environment(@Payload() value: unknown) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== this.options.owner ||
      !['fence', 'erase', 'readback', 'finalize'].includes(value.action) ||
      !this.options.database
    )
      throw Error('DELETION_ENVIRONMENT_GRANT_INVALID');
    const before = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    if (
      this.options.scopeReadback &&
      (await this.options.scopeReadback(
        value.accountId,
        before.scope?.currentProfileIds ?? null
      )) !== 0
    )
      throw Error('DELETION_RELEASE_SCOPE_UNRESOLVED');
    const logging = payloadFreeLoggingStatus();
    const databaseLogging = await databaseLoggingStatus(this.options.database);
    const after = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    if (
      !logging.active ||
      !databaseLogging.active ||
      JSON.stringify(before.scope) !== JSON.stringify(after.scope)
    )
      throw Error('DELETION_ENVIRONMENT_UNVERIFIED');
    return { owner: this.options.owner, logging, databaseLogging };
  }

  @MessagePattern({ cmd: ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND })
  async custody(
    @Payload()
    request: {
      grant: unknown;
      probe: { nonce: string; mode: 'write' | 'read' | 'remove' };
    }
  ) {
    const value = request?.grant;
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== this.options.owner ||
      !['fence', 'readback'].includes(value.action) ||
      !this.options.custodyProbe
    )
      throw Error('DELETION_CUSTODY_GRANT_INVALID');
    const before = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    const storeId = await this.options.custodyProbe(
      request.probe?.nonce,
      request.probe?.mode
    );
    const after = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    if (JSON.stringify(before.scope) !== JSON.stringify(after.scope))
      throw Error('DELETION_CUSTODY_UNVERIFIED');
    return { owner: this.options.owner, storeId };
  }

  @MessagePattern({ cmd: ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND })
  async runtime(@Payload() value: unknown) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== this.options.owner ||
      value.action !== 'readback'
    )
      throw Error('DELETION_RUNTIME_GRANT_INVALID');
    const before = await this.options.authority.validate(
      value,
      this.options.owner,
      'readback'
    );
    if (
      this.options.scopeReadback &&
      (await this.options.scopeReadback(
        value.accountId,
        before.scope?.currentProfileIds ?? null
      )) !== 0
    )
      throw Error('DELETION_RELEASE_SCOPE_UNRESOLVED');
    const remaining = await this.options.spool.readbackAccount(value.accountId);
    if (!before.scope || before.scope.legacyProfileIds.length)
      throw Error('DELETION_RUNTIME_SCOPE_REQUIRED');
    const audit = this.options.audit
      ? {
          remaining: await this.options.audit.readbackParticipation({
            accountId: value.accountId,
            profileIds: before.scope.currentProfileIds,
          }),
        }
      : undefined;
    if (audit && audit.remaining !== 0)
      throw Error('DELETION_AUDIT_READBACK_UNVERIFIED');
    const databaseLogging = this.options.database
      ? await databaseLoggingStatus(this.options.database)
      : { policyVersion: 1, active: false };
    const logging = payloadFreeLoggingStatus();
    const after = await this.options.authority.validate(
      value,
      this.options.owner,
      'readback'
    );
    if (
      remaining !== 0 ||
      JSON.stringify(before.scope) !== JSON.stringify(after.scope)
    )
      throw Error('DELETION_RUNTIME_UNVERIFIED');
    return {
      owner: this.options.owner,
      instanceId: this.instanceId,
      remaining: 0,
      logging,
      databaseLogging,
      ...(audit ? { audit } : {}),
    };
  }

  @MessagePattern({ cmd: ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND })
  async purge(@Payload() value: unknown) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== this.options.owner ||
      !['fence', 'readback'].includes(value.action)
    )
      throw Error('DELETION_SNAPSHOT_GRANT_INVALID');
    const before = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    const outcomes = await Promise.allSettled([
      this.options.snapshot.purgeAccount(value.accountId),
      this.options.spool.purgeAccount(value.accountId),
    ]);
    const failure = outcomes.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const result = (outcomes[0] as PromiseFulfilledResult<{ remaining: 0 }>)
      .value;
    const spoolsRemaining = await this.options.spool.readbackAccount(
      value.accountId
    );
    const after = await this.options.authority.validate(
      value,
      this.options.owner,
      value.action
    );
    if (
      result?.remaining !== 0 ||
      spoolsRemaining !== 0 ||
      JSON.stringify(before.scope) !== JSON.stringify(after.scope)
    )
      throw Error('DELETION_SNAPSHOT_READBACK');
    return { purged: true, remaining: 0 };
  }
}
