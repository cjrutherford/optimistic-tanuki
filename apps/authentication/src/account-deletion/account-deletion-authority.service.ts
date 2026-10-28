import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ACCOUNT_DELETION_CONTRACT_VERSION,
  ACCOUNT_DELETION_OWNERS,
  ACCOUNT_DELETION_APP_IDS,
  AccountDeletionAction,
  AccountDeletionAppId,
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  AccountDeletionStatus,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  deletionIdentityKey,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const LEASE_MS = 60_000;
const PROGRESS_STATES = new Set(['pending', 'running', 'blocked', 'complete']);

@Injectable()
export class AccountDeletionAuthorityService {
  constructor(
    @Inject(getRepositoryToken(AccountDeletionOperationEntity))
    private readonly operations: Repository<AccountDeletionOperationEntity>,
    @Inject('AUTHENTICATION_CONNECTION') private readonly database: DataSource
  ) {}

  async accept(
    accountId: string,
    appId: string,
    idempotencyKey: string,
    preparedOperationId?: string
  ): Promise<AccountDeletionOperationEntity> {
    const account = this.actorUuid(
      accountId,
      'ACCOUNT_DELETION_ACCOUNT_INVALID'
    );
    if (!(ACCOUNT_DELETION_APP_IDS as readonly string[]).includes(appId))
      throw new Error('ACCOUNT_DELETION_APP_INVALID');
    const key = this.actorUuid(
      idempotencyKey,
      'ACCOUNT_DELETION_IDEMPOTENCY_INVALID'
    );
    const fenceKey = deletionIdentityKey('account', account);
    const operationId =
      preparedOperationId === undefined
        ? undefined
        : this.actorUuid(
            preparedOperationId,
            'ACCOUNT_DELETION_OPERATION_INVALID'
          );
    return this.database.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [account]
      );
      const repository = manager.getRepository(AccountDeletionOperationEntity);
      const existing = await repository.findOne({ where: { fenceKey } });
      if (existing) {
        if (
          operationId &&
          (existing.id !== operationId ||
            existing.appId !== appId ||
            existing.idempotencyKey !== key)
        )
          throw Error('ACCOUNT_DELETION_PREPARATION_CONFLICT');
        return existing;
      }
      const row = repository.create({
        ...(operationId ? { id: operationId } : {}),
        accountId: account,
        fenceKey,
        appId,
        state: 'fencing',
        idempotencyKey: key,
        attempt: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        privateScope: null,
        ownerProgress: {},
      });
      const saved = await repository.save(row);
      await installDeletionWriteFence(manager, saved.id, [
        { kind: 'account', id: account },
      ]);
      // Revoke before acknowledgement while the account write fence is held.
      await manager.query(
        "SELECT set_config('ot.deletion_operation', $1, true)",
        [saved.id]
      );
      await manager.query('UPDATE token SET revoked=true WHERE "userId"=$1', [
        account,
      ]);
      return saved;
    });
  }

  async claim(operationId: string): Promise<{
    operationId: string;
    attempt: number;
    leaseOwner: string;
    leaseExpiresAt: Date;
  }> {
    const id = this.actorUuid(
      operationId,
      'ACCOUNT_DELETION_OPERATION_INVALID'
    );
    return this.database.transaction(async (manager) => {
      const repo = manager.getRepository(AccountDeletionOperationEntity);
      const row = await repo
        .createQueryBuilder('operation')
        .setLock('pessimistic_write')
        .where('operation.id = :id', { id })
        .getOne();
      if (!row || row.state === 'complete')
        throw new Error('ACCOUNT_DELETION_OPERATION_UNAVAILABLE');
      if (row.leaseExpiresAt && row.leaseExpiresAt.getTime() > Date.now())
        throw new Error('ACCOUNT_DELETION_LEASE_ACTIVE');
      const leaseOwner = randomUUID();
      row.attempt += 1;
      row.leaseOwner = leaseOwner;
      row.leaseExpiresAt = new Date(Date.now() + LEASE_MS);
      row.state = ACCOUNT_DELETION_OWNERS.every((owner) =>
        this.receipt(row, owner, 'fence')
      )
        ? 'deleting'
        : 'fencing';
      await repo.save(row);
      return {
        operationId: row.id,
        attempt: row.attempt,
        leaseOwner,
        leaseExpiresAt: row.leaseExpiresAt,
      };
    });
  }

  async issueGrant(
    operationId: string,
    owner: string,
    action: AccountDeletionAction
  ): Promise<AccountDeletionGrant> {
    const row = await this.liveOperation(operationId);
    if (row.accountId === null)
      throw new Error('ACCOUNT_DELETION_ACCOUNT_UNAVAILABLE');
    if (!(ACCOUNT_DELETION_OWNERS as readonly string[]).includes(owner))
      throw new Error('ACCOUNT_DELETION_OWNER_INVALID');
    if (!['fence', 'erase', 'readback', 'finalize'].includes(action))
      throw new Error('ACCOUNT_DELETION_ACTION_INVALID');
    if (
      row.privateScope !== null &&
      !validateDeletionIdentityDomains(row.privateScope)
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_INVALID');
    if (
      owner !== 'profile' &&
      !(owner === 'authentication' && action === 'fence') &&
      row.privateScope === null
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_REQUIRED');
    const key = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    if (!key || Buffer.byteLength(key, 'utf8') < 32)
      throw new Error('ACCOUNT_DELETION_PROOF_KEY_REQUIRED');
    this.assertActionPhase(row, action);
    if (
      action === 'finalize' &&
      (!['profile', 'authentication'].includes(owner) ||
        (owner === 'authentication' &&
          !this.receipt(row, 'profile', 'finalize')))
    )
      throw Error('ACCOUNT_DELETION_FINALIZATION_ORDER');
    if (action === 'readback' && !this.receipt(row, owner, 'erase'))
      throw new Error('ACCOUNT_DELETION_ERASURE_PENDING');
    const expiresAt = new Date(
      Math.min(Date.now() + 30_000, row.leaseExpiresAt!.getTime())
    ).toISOString();
    const grant = {
      contractVersion: ACCOUNT_DELETION_CONTRACT_VERSION,
      operationId: row.id,
      accountId: row.accountId,
      appId: row.appId as AccountDeletionAppId,
      owner: owner as AccountDeletionGrant['owner'],
      action,
      attempt: row.attempt,
      leaseOwner: row.leaseOwner!,
      expiresAt,
      signature: '',
    };
    grant.signature = this.signature(grant, key);
    return grant;
  }

  async validateGrant(value: unknown): Promise<{
    valid: true;
    accountId: string;
    scope: AccountDeletionIdentityDomains | null;
  }> {
    if (
      !validateDeletionGrantShape(value) ||
      !(ACCOUNT_DELETION_OWNERS as readonly string[]).includes(value.owner) ||
      !['fence', 'erase', 'readback', 'finalize'].includes(value.action)
    )
      throw new Error('ACCOUNT_DELETION_GRANT_INVALID');
    const key = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    if (!key || Buffer.byteLength(key, 'utf8') < 32)
      throw new Error('ACCOUNT_DELETION_PROOF_KEY_REQUIRED');
    const expected = this.signature(value, key);
    if (
      !timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(value.signature, 'hex')
      )
    )
      throw new Error('ACCOUNT_DELETION_GRANT_INVALID');
    const row = await this.liveOperation(value.operationId);
    if (
      !row.accountId ||
      row.accountId !== value.accountId ||
      row.appId !== value.appId ||
      row.attempt !== value.attempt ||
      row.leaseOwner !== value.leaseOwner ||
      Date.parse(value.expiresAt) > row.leaseExpiresAt!.getTime() ||
      Date.parse(value.expiresAt) <= Date.now()
    )
      throw new Error('ACCOUNT_DELETION_GRANT_STALE');
    if (
      value.owner !== 'profile' &&
      !(value.owner === 'authentication' && value.action === 'fence') &&
      (!row.privateScope || !validateDeletionIdentityDomains(row.privateScope))
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_REQUIRED');
    this.assertActionPhase(row, value.action);
    return { valid: true, accountId: row.accountId, scope: row.privateScope };
  }

  async recordProfileScope(
    value: AccountDeletionGrant,
    scope: AccountDeletionIdentityDomains
  ): Promise<void> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'profile' ||
      value.action !== 'fence' ||
      !validateDeletionIdentityDomains(scope)
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_INVALID');
    await this.validateGrant(value);
    await this.database.transaction(async (manager) => {
      const repo = manager.getRepository(AccountDeletionOperationEntity);
      const row = await repo
        .createQueryBuilder('operation')
        .setLock('pessimistic_write')
        .where('operation.id = :id', { id: value.operationId })
        .getOne();
      if (
        !row ||
        row.state === 'complete' ||
        row.accountId !== value.accountId ||
        row.appId !== value.appId ||
        row.attempt !== value.attempt ||
        row.leaseOwner !== value.leaseOwner ||
        !row.leaseExpiresAt ||
        row.leaseExpiresAt.getTime() <= Date.now() ||
        Date.parse(value.expiresAt) <= Date.now() ||
        Date.parse(value.expiresAt) > row.leaseExpiresAt.getTime()
      )
        throw new Error('ACCOUNT_DELETION_GRANT_STALE');
      if (
        row.privateScope &&
        (!validateDeletionIdentityDomains(row.privateScope) ||
          !this.sameScope(row.privateScope, scope))
      )
        throw new Error('ACCOUNT_DELETION_SCOPE_CONFLICT');
      row.privateScope ??= {
        currentProfileIds: [...scope.currentProfileIds],
        legacyProfileIds: [...scope.legacyProfileIds],
      };
      await repo.save(row);
    });
  }

  /** Called by the trusted coordinator only after the owner has independently read back its result. */
  async acknowledge(grant: AccountDeletionGrant): Promise<void> {
    await this.validateGrant(grant);
    await this.database.transaction(async (manager) => {
      const repo = manager.getRepository(AccountDeletionOperationEntity);
      const row = await repo
        .createQueryBuilder('operation')
        .setLock('pessimistic_write')
        .where('operation.id = :id', { id: grant.operationId })
        .getOne();
      if (
        !row ||
        row.state === 'complete' ||
        row.accountId !== grant.accountId ||
        row.appId !== grant.appId ||
        row.attempt !== grant.attempt ||
        row.leaseOwner !== grant.leaseOwner ||
        !row.leaseExpiresAt ||
        row.leaseExpiresAt.getTime() <= Date.now() ||
        Date.parse(grant.expiresAt) <= Date.now()
      )
        throw new Error('ACCOUNT_DELETION_GRANT_STALE');
      this.assertActionPhase(row, grant.action);
      if (
        grant.owner === 'profile' &&
        grant.action === 'fence' &&
        !row.privateScope
      )
        throw new Error('ACCOUNT_DELETION_SCOPE_REQUIRED');
      const prior = row.ownerProgress[grant.owner];
      const receipt =
        prior && typeof prior === 'object' && !Array.isArray(prior)
          ? (prior as Record<string, unknown>)
          : {};
      row.ownerProgress = {
        ...row.ownerProgress,
        [grant.owner]: {
          fence: receipt['fence'] === true || grant.action === 'fence',
          erase: receipt['erase'] === true || grant.action === 'erase',
          readback: receipt['readback'] === true || grant.action === 'readback',
          ...(receipt['finalize'] === true || grant.action === 'finalize'
            ? { finalize: true }
            : {}),
        },
      };
      if (
        ACCOUNT_DELETION_OWNERS.every((owner) =>
          this.receipt(row, owner, 'fence')
        )
      )
        row.state = 'deleting';
      // Root identity/key disposal and terminal completion remain D26/D27 responsibilities.
      await repo.save(row);
    });
  }

  async clearNonOrm(grant: AccountDeletionGrant): Promise<void> {
    if (grant.owner !== 'authentication' || grant.action !== 'readback')
      throw Error('ACCOUNT_DELETION_NON_ORM_GRANT');
    await this.validateGrant(grant);
    await this.database.transaction(async (manager) => {
      const repo = manager.getRepository(AccountDeletionOperationEntity);
      const row = await repo.findOne({
        where: { id: grant.operationId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertCurrent(row, grant);
      row!.ownerProgress = {
        ...row!.ownerProgress,
        _nonOrm: { verified: false, version: 1, attempt: grant.attempt },
      };
      await repo.save(row!);
    });
  }

  async recordNonOrm(
    grant: AccountDeletionGrant,
    stores: readonly string[]
  ): Promise<void> {
    if (grant.owner !== 'authentication' || grant.action !== 'readback')
      throw Error('ACCOUNT_DELETION_NON_ORM_GRANT');
    await this.validateGrant(grant);
    await this.database.transaction(async (manager) => {
      const repo = manager.getRepository(AccountDeletionOperationEntity);
      const row = await repo.findOne({
        where: { id: grant.operationId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertCurrent(row, grant);
      if (
        !ACCOUNT_DELETION_OWNERS.every((o) => this.receipt(row!, o, 'readback'))
      )
        throw Error('ACCOUNT_DELETION_READBACKS_PENDING');
      const expected = [
        'jobs-and-spools',
        'oauth-and-sessions',
        'permission-caches',
        'search-copies',
        'diagnostics-and-audits',
        'media-versions-and-keys',
        'browser-owned-state',
        'provider-grants',
      ];
      if (JSON.stringify(stores) !== JSON.stringify(expected))
        throw Error('ACCOUNT_DELETION_NON_ORM_INVENTORY');
      row!.ownerProgress = {
        ...row!.ownerProgress,
        _nonOrm: {
          verified: true,
          version: 1,
          attempt: grant.attempt,
          stores: [...stores],
        },
      };
      await repo.save(row!);
    });
  }
  private assertCurrent(
    row: AccountDeletionOperationEntity | null,
    grant: AccountDeletionGrant
  ) {
    if (
      !row ||
      row.state === 'complete' ||
      row.accountId !== grant.accountId ||
      row.attempt !== grant.attempt ||
      row.leaseOwner !== grant.leaseOwner ||
      !row.leaseExpiresAt ||
      row.leaseExpiresAt.getTime() <= Date.now() ||
      Date.parse(grant.expiresAt) <= Date.now()
    )
      throw Error('ACCOUNT_DELETION_GRANT_STALE');
  }
  async renew(
    operationId: string,
    attempt: number,
    leaseOwner: string
  ): Promise<void> {
    const rows = await this.database.query(
      `WITH changed AS (UPDATE account_deletion_operations SET "leaseExpiresAt"=clock_timestamp()+interval '60 seconds' WHERE id=$1 AND attempt=$2 AND "leaseOwner"=$3 AND "leaseExpiresAt">clock_timestamp() AND state<>'complete' RETURNING id) SELECT id FROM changed`,
      [operationId, attempt, leaseOwner]
    );
    if (!Array.isArray(rows) || rows.length !== 1)
      throw Error('ACCOUNT_DELETION_LEASE_STALE');
  }
  async releaseBlocked(
    operationId: string,
    attempt: number,
    leaseOwner: string,
    blocker = 'deletion-unverified'
  ): Promise<void> {
    if (!/^[a-z0-9-]{1,96}$/.test(blocker))
      throw Error('ACCOUNT_DELETION_BLOCKER_INVALID');
    await this.database.query(
      `UPDATE account_deletion_operations SET state='blocked',"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp(),"ownerProgress"=jsonb_set("ownerProgress",'{_blocker}',to_jsonb($4::text),true) WHERE id=$1 AND attempt=$2 AND "leaseOwner"=$3 AND state<>'complete'`,
      [operationId, attempt, leaseOwner, blocker]
    );
  }

  private receipt(
    row: AccountDeletionOperationEntity,
    owner: string,
    action: AccountDeletionAction
  ): boolean {
    const value = row.ownerProgress?.[owner];
    return Boolean(
      value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)[action] === true
    );
  }

  private assertActionPhase(
    row: AccountDeletionOperationEntity,
    action: AccountDeletionAction
  ): void {
    if (!['fence', 'erase', 'readback', 'finalize'].includes(action))
      throw new Error('ACCOUNT_DELETION_ACTION_INVALID');
    if (action === 'finalize') {
      if (
        !ACCOUNT_DELETION_OWNERS.every((owner) =>
          this.receipt(row, owner, 'readback')
        ) ||
        !(row.ownerProgress['_nonOrm'] as any)?.verified ||
        (row.ownerProgress['_nonOrm'] as any)?.attempt !== row.attempt
      )
        throw Error('ACCOUNT_DELETION_FINALIZATION_PENDING');
    }
    if (
      action !== 'fence' &&
      !ACCOUNT_DELETION_OWNERS.every((owner) =>
        this.receipt(row, owner, 'fence')
      )
    )
      throw new Error('ACCOUNT_DELETION_FENCES_PENDING');
  }

  async status(operationId: string): Promise<AccountDeletionStatus> {
    const row = await this.operations.findOneBy({
      id: this.actorUuid(operationId, 'ACCOUNT_DELETION_OPERATION_INVALID'),
    });
    if (!row) throw new Error('ACCOUNT_DELETION_OPERATION_NOT_FOUND');
    const state = ['fencing', 'deleting', 'blocked', 'complete'].includes(
      row.state
    )
      ? row.state
      : 'blocked';
    const progress = ACCOUNT_DELETION_OWNERS.map((owner) => {
      const value =
        row.ownerProgress &&
        typeof row.ownerProgress === 'object' &&
        !Array.isArray(row.ownerProgress)
          ? row.ownerProgress[owner]
          : undefined;
      return {
        owner,
        status:
          state === 'complete'
            ? 'complete'
            : typeof value === 'string' && PROGRESS_STATES.has(value)
            ? (value as 'pending' | 'running' | 'blocked' | 'complete')
            : value &&
              typeof value === 'object' &&
              !Array.isArray(value) &&
              (value as Record<string, unknown>)['readback'] === true
            ? 'complete'
            : value &&
              typeof value === 'object' &&
              !Array.isArray(value) &&
              ((value as Record<string, unknown>)['fence'] === true ||
                (value as Record<string, unknown>)['erase'] === true)
            ? 'running'
            : 'pending',
      };
    });
    return {
      contractVersion: ACCOUNT_DELETION_CONTRACT_VERSION,
      operationId: row.id,
      appId: (ACCOUNT_DELETION_APP_IDS as readonly string[]).includes(row.appId)
        ? (row.appId as AccountDeletionAppId)
        : 'client-interface',
      state,
      attempt:
        Number.isSafeInteger(row.attempt) && row.attempt >= 0 ? row.attempt : 0,
      progress,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async liveOperation(
    id: string
  ): Promise<AccountDeletionOperationEntity> {
    const row = await this.operations.findOneBy({
      id: this.actorUuid(id, 'ACCOUNT_DELETION_OPERATION_INVALID'),
    });
    if (
      !row ||
      row.state === 'complete' ||
      !row.leaseOwner ||
      !row.leaseExpiresAt ||
      row.leaseExpiresAt.getTime() <= Date.now()
    )
      throw new Error('ACCOUNT_DELETION_LEASE_STALE');
    return row;
  }

  private signature(
    grant: Omit<AccountDeletionGrant, 'signature'> | AccountDeletionGrant,
    key: string
  ): string {
    const { signature: _signature, ...fields } = grant as AccountDeletionGrant;
    return createHmac('sha256', key)
      .update(
        JSON.stringify([
          fields.contractVersion,
          fields.operationId,
          fields.accountId,
          fields.appId,
          fields.owner,
          fields.action,
          fields.attempt,
          fields.leaseOwner,
          fields.expiresAt,
        ])
      )
      .digest('hex');
  }

  private sameScope(
    a: AccountDeletionIdentityDomains,
    b: AccountDeletionIdentityDomains
  ): boolean {
    return (
      Array.isArray(a.currentProfileIds) &&
      Array.isArray(a.legacyProfileIds) &&
      [...a.currentProfileIds].sort().join('\0') ===
        [...b.currentProfileIds].sort().join('\0') &&
      [...a.legacyProfileIds].sort().join('\0') ===
        [...b.legacyProfileIds].sort().join('\0')
    );
  }

  private actorUuid(value: unknown, code: string): string {
    if (
      typeof value !== 'string' ||
      !UUID.test(value) ||
      value.toLowerCase() === NIL_UUID
    )
      throw new Error(code);
    return value.toLowerCase();
  }
}
