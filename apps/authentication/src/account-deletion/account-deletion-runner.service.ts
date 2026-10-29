import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionGrant,
  AccountDeletionOwner,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionNonOrmService } from './account-deletion-non-orm.service';
import { AccountDeletionFinalizerService } from './account-deletion-finalizer.service';
export const DELETION_OWNER_PORTS = Symbol('DELETION_OWNER_PORTS');
export type DeletionOwnerPorts = ReadonlyMap<
  AccountDeletionOwner,
  (grant: AccountDeletionGrant) => Promise<unknown>
>;
const ERASE_ORDER: readonly AccountDeletionOwner[] = [
  'videos',
  'assets',
  'social',
  'forum',
  'chat-collector',
  'classifieds',
  'payments',
  'workspace',
  'app-configurator',
  'permissions',
  'profile',
  'authentication',
];
@Injectable()
export class AccountDeletionRunnerService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private stopping = false;
  private active = new Set<string>();
  constructor(
    private readonly authority: AccountDeletionAuthorityService,
    private readonly nonOrm: AccountDeletionNonOrmService,
    private readonly finalizer: AccountDeletionFinalizerService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly db: DataSource,
    @Inject(DELETION_OWNER_PORTS) private readonly ports: DeletionOwnerPorts
  ) {}
  onModuleInit() {
    if (process.env['ACCOUNT_DELETION_WORKER_ENABLED'] === 'false') return;
    this.timer = setInterval(() => {
      void this.recover().catch(() => {});
    }, 30000);
    this.timer.unref();
    void this.recover().catch(() => {});
  }
  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
  }
  async recover() {
    if (this.stopping) return;
    const rows = await this.db.query(
      `SELECT id FROM account_deletion_operations WHERE state<>'complete' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp()) AND (attempt=0 OR "updatedAt"<clock_timestamp()-interval '30 seconds') ORDER BY "createdAt" LIMIT 5`
    );
    for (const row of rows) {
      if (this.stopping) break;
      await this.run(row.id);
    }
  }
  async run(id: string) {
    if (this.stopping || this.active.has(id)) return;
    this.active.add(id);
    let lease:
      | Awaited<ReturnType<AccountDeletionAuthorityService['claim']>>
      | undefined;
    let renew: ReturnType<typeof setInterval> | undefined;
    let leaseLost = false;
    let blocker = 'deletion-unverified';
    const snapshot = async () => {
      const rows = await this.db.query(
        'SELECT "ownerProgress","privateScope" FROM account_deletion_operations WHERE id=$1',
        [id]
      );
      if (rows.length !== 1) throw Error('DELETION_OPERATION_MISSING');
      return rows[0];
    };
    try {
      lease = await this.authority.claim(id);
      const current = lease;
      renew = setInterval(() => {
        void this.authority
          .renew(id, current.attempt, current.leaseOwner)
          .catch(() => {
            leaseLost = true;
          });
      }, 10000);
      renew.unref();
      const invoke = async (
        owner: AccountDeletionOwner,
        action: AccountDeletionGrant['action']
      ) => {
        if (leaseLost || this.stopping) throw Error('DELETION_LEASE_LOST');
        blocker = owner + '-' + action + '-unverified';
        const grant = await this.authority.issueGrant(id, owner, action);
        const port = this.ports.get(owner);
        if (!port) throw Error('DELETION_OWNER_UNAVAILABLE');
        const reply = await port(grant);
        const n = (await snapshot()).privateScope?.currentProfileIds?.length;
        if (!this.validReply(owner, action, reply, n))
          throw Error('DELETION_OWNER_READBACK_INVALID');
        if (leaseLost || this.stopping) throw Error('DELETION_LEASE_LOST');
        await this.authority.acknowledge(grant);
      };
      for (const owner of [
        'profile',
        ...ACCOUNT_DELETION_OWNERS.filter((o) => o !== 'profile'),
      ] as AccountDeletionOwner[])
        if ((await snapshot()).ownerProgress?.[owner]?.fence !== true)
          await invoke(owner, 'fence');
      for (const action of ['erase', 'readback'] as const)
        for (const owner of ERASE_ORDER)
          if ((await snapshot()).ownerProgress?.[owner]?.[action] !== true)
            await invoke(owner, action);
      blocker = 'non-orm-unverified';
      const outcome = await this.nonOrm.execute(
        await this.authority.issueGrant(id, 'authentication', 'readback')
      );
      if (!outcome.verified) throw Error('DELETION_NON_ORM_UNVERIFIED');
      if ((await snapshot()).ownerProgress?.profile?.finalize !== true)
        await invoke('profile', 'finalize');
      if (leaseLost || this.stopping) throw Error('DELETION_LEASE_LOST');
      blocker = 'authentication-finalization-unverified';
      await this.finalizer.finalize(
        await this.authority.issueGrant(id, 'authentication', 'finalize')
      );
    } catch {
      if (lease)
        await this.authority.releaseBlocked(
          id,
          lease.attempt,
          lease.leaseOwner,
          blocker
        );
    } finally {
      if (renew) clearInterval(renew);
      this.active.delete(id);
    }
    return this.authority.status(id);
  }
  private validReply(
    owner: AccountDeletionOwner,
    action: AccountDeletionGrant['action'],
    value: unknown,
    profiles: number
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const r = value as Record<string, unknown>;
    if (action === 'finalize')
      return (
        owner === 'profile' && r['finalized'] === true && r['remaining'] === 0
      );
    if (owner === 'authentication') {
      if (action === 'fence') return r['fenced'] === true;
      if (action === 'erase') return r['erased'] === true;
      return (
        r['complete'] === true &&
        !!r['counts'] &&
        typeof r['counts'] === 'object' &&
        Object.keys(r['counts']).sort().join(',') ===
          [
            'token_account',
            'token_profile',
            'oauth_provider',
            'auth_action_token',
            'guardian_permission',
            'guardian_policy_notice',
            'account_export_jobs',
          ]
            .sort()
            .join(',') &&
        Object.values(r['counts']).every((n) => n === 0) &&
        Array.isArray(r['unresolvedAttribution']) &&
        r['unresolvedAttribution'].length === 0
      );
    }
    if (owner === 'profile' || owner === 'assets')
      return (
        r['fenced'] === true &&
        Number.isSafeInteger(profiles) &&
        r['profileCount'] === profiles &&
        (owner !== 'profile' || r['legacyCount'] === 0)
      );
    if (owner === 'videos') return r['verified'] === true;
    return (
      r['verified'] === true &&
      typeof r['remaining'] === 'number' &&
      Number.isSafeInteger(r['remaining']) &&
      r['remaining'] >= 0 &&
      (action === 'fence' || r['remaining'] === 0)
    );
  }
}
