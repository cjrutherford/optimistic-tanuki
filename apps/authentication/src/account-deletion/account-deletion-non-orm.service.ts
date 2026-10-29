import { Inject, Injectable } from '@nestjs/common';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
/** Fixed N01–N07 denominator. Deployment-owned adapters must prove each declared store. */
export const DELETION_NON_ORM_STORES = Object.freeze([
  'jobs-and-spools',
  'oauth-and-sessions',
  'permission-caches',
  'search-copies',
  'diagnostics-and-audits',
  'media-versions-and-keys',
  'browser-owned-state',
  'provider-grants',
] as const);
export const DELETION_NON_ORM_ADAPTERS = Symbol('DELETION_NON_ORM_ADAPTERS');
export type DeletionNonOrmSubject = Readonly<{
  accountId: string;
  profileIds: readonly string[];
  operationId: string;
  /** Server-issued current-attempt capability; never serialize to diagnostics. */
  grant: Readonly<AccountDeletionGrant>;
}>;
export interface DeletionNonOrmAdapter {
  readonly verificationMode?: 'session-boundary';
  /** Fence/drain every declared replica before purging; throw if topology or custody is unknown. */
  purge(subject: DeletionNonOrmSubject): Promise<void>;
  readback(subject: DeletionNonOrmSubject): Promise<number>;
}
@Injectable()
export class AccountDeletionNonOrmService {
  constructor(
    private readonly authority: AccountDeletionAuthorityService,
    @Inject(DELETION_NON_ORM_ADAPTERS)
    private readonly adapters: ReadonlyMap<string, DeletionNonOrmAdapter>
  ) {}
  async execute(grant: AccountDeletionGrant) {
    if (grant.owner !== 'authentication' || grant.action !== 'readback')
      throw Error('DELETION_NON_ORM_GRANT_INVALID');
    const { scope } = await this.authority.validateGrant(grant);
    if (!scope) throw Error('DELETION_NON_ORM_SCOPE_REQUIRED');
    await this.authority.clearNonOrm(grant);
    const subject = Object.freeze({
      accountId: grant.accountId,
      profileIds: Object.freeze([...scope.currentProfileIds]),
      operationId: grant.operationId,
      grant: Object.freeze({ ...grant }),
    });
    const fresh = async () => {
      const current = await this.authority.validateGrant(grant);
      if (JSON.stringify(current.scope) !== JSON.stringify(scope))
        throw Error('DELETION_NON_ORM_SCOPE_CHANGED');
    };
    const results: Array<{
      store: string;
      code: string;
      mode?: 'session-boundary';
    }> = [];
    if (
      [...this.adapters.keys()].some(
        (k) => !(DELETION_NON_ORM_STORES as readonly string[]).includes(k)
      )
    )
      return {
        verified: false,
        results: [{ store: 'inventory', code: 'UNKNOWN_STORE' }],
      };
    for (const store of DELETION_NON_ORM_STORES) {
      const adapter = this.adapters.get(store);
      if (!adapter) {
        results.push({ store, code: 'ADAPTER_UNAVAILABLE' });
        continue;
      }
      try {
        await fresh();
        await adapter.purge(subject);
        const n = await adapter.readback(subject);
        await fresh();
        results.push({
          store,
          ...(adapter.verificationMode
            ? { mode: adapter.verificationMode }
            : {}),
          code:
            typeof n === 'number' && Number.isSafeInteger(n) && n === 0
              ? 'VERIFIED'
              : 'READBACK_UNVERIFIED',
        });
      } catch {
        results.push({ store, code: 'PURGE_UNVERIFIED' });
      }
    }
    const verified = results.every((r) => r.code === 'VERIFIED');
    if (verified)
      await this.authority.recordNonOrm(grant, DELETION_NON_ORM_STORES);
    return { verified, results };
  }
}
