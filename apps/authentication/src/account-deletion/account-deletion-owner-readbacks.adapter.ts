import { Injectable } from '@nestjs/common';
import {
  AccountDeletionOwner,
  ACCOUNT_DELETION_OWNERS,
  validateDeletionGrantShape,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionRpcOwnersService } from './account-deletion-rpc-owners.service';
import {
  DeletionNonOrmAdapter,
  DeletionNonOrmSubject,
} from './account-deletion-non-orm.service';

type Family =
  | 'search-copies'
  | 'media-versions-and-keys'
  | 'jobs-and-spools'
  | 'diagnostics-and-audits';
/** D25 invokes the accepted N03/D03/D04 owner contracts again after owner erasure.
 * It does not turn an absent pointer or saved acknowledgement into a custody receipt. */
@Injectable()
export class AccountDeletionOwnerReadbacksAdapter {
  constructor(
    private readonly authority: AccountDeletionAuthorityService,
    private readonly owners: AccountDeletionRpcOwnersService
  ) {}
  forFamily(family: Family): DeletionNonOrmAdapter {
    if (
      ![
        'search-copies',
        'media-versions-and-keys',
        'jobs-and-spools',
        'diagnostics-and-audits',
      ].includes(family)
    )
      throw Error('DELETION_OWNER_FAMILY_INVALID');
    return {
      purge: (subject) => this.check(subject, family),
      readback: async (subject) => {
        await this.check(subject, family);
        return 0;
      },
    };
  }
  private async check(
    subject: DeletionNonOrmSubject,
    family: Family
  ): Promise<void> {
    const grant = subject.grant;
    if (
      !validateDeletionGrantShape(grant) ||
      grant.owner !== 'authentication' ||
      grant.action !== 'readback' ||
      grant.accountId !== subject.accountId ||
      grant.operationId !== subject.operationId
    )
      throw Error('DELETION_OWNER_SUBJECT_INVALID');
    const fresh = async () => {
      const { scope } = await this.authority.validateGrant(grant);
      if (
        !scope ||
        scope.legacyProfileIds.length ||
        JSON.stringify([...scope.currentProfileIds].sort()) !==
          JSON.stringify([...subject.profileIds].sort())
      )
        throw Error('DELETION_OWNER_SCOPE_CHANGED');
    };
    await fresh();
    if (family === 'diagnostics-and-audits') {
      let inventory: unknown;
      try {
        inventory = JSON.parse(
          process.env['ACCOUNT_DELETION_LOG_INVENTORY'] ?? 'null'
        );
      } catch {
        throw Error('DELETION_LOG_INVENTORY_INVALID');
      }
      const facts = inventory as Record<string, unknown> | null;
      if (
        !facts ||
        facts['scope'] !== 'local-ot-ts' ||
        facts['noForwardedCollectors'] !== true ||
        facts['noRetainedLegacyLogs'] !== true ||
        typeof facts['confirmedAt'] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(facts['confirmedAt'])
      )
        throw Error('DELETION_LOG_INVENTORY_REQUIRED');
    }
    const participants: AccountDeletionOwner[] =
      family === 'search-copies'
        ? ['social']
        : family === 'media-versions-and-keys'
        ? ['assets', 'videos']
        : [...ACCOUNT_DELETION_OWNERS];
    for (const owner of participants) {
      const port = this.owners.ports.get(owner);
      if (!port) throw Error('DELETION_OWNER_UNAVAILABLE');
      const capability = await this.authority.issueGrant(
        grant.operationId,
        owner,
        'readback'
      );
      const runtimeCheck = async () => {
        const replies = await this.owners.runtimeReadbacks(capability);
        const needsAudit =
          family === 'diagnostics-and-audits' &&
          ['profile', 'assets', 'social', 'forum'].includes(owner);
        if (
          !replies.length ||
          replies.some(
            (reply) =>
              reply.remaining !== 0 ||
              (family === 'diagnostics-and-audits' &&
                (!reply.logging.active || !reply.databaseLogging.active)) ||
              (needsAudit && reply.audit?.remaining !== 0)
          )
        )
          throw Error('DELETION_OWNER_RUNTIME_UNVERIFIED');
      };
      if (
        owner === 'profile' &&
        (family === 'jobs-and-spools' || family === 'diagnostics-and-audits')
      ) {
        // D26 may already have removed Profile roots when Auth finalization retries.
        // The signed runtime/audit readback uses frozen IDs and never requires a live root.
        await runtimeCheck();
        await fresh();
        continue;
      }
      const raw = await port(capability);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw Error('DELETION_OWNER_CUSTODY_UNVERIFIED');
      const result = raw as Record<string, unknown>;
      const verified =
        owner === 'authentication'
          ? result['complete'] === true &&
            Array.isArray(result['unresolvedAttribution']) &&
            result['unresolvedAttribution'].length === 0
          : owner === 'profile'
          ? result['fenced'] === true &&
            result['profileCount'] === subject.profileIds.length &&
            result['legacyCount'] === 0
          : [
              'permissions',
              'workspace',
              'app-configurator',
              'chat-collector',
              'classifieds',
              'payments',
            ].includes(owner)
          ? result['verified'] === true && result['remaining'] === 0
          : owner === 'assets'
          ? result['fenced'] === true &&
            result['profileCount'] === subject.profileIds.length
          : result['verified'] === true &&
            (!['social', 'forum'].includes(owner) || result['remaining'] === 0);
      if (!verified) throw Error('DELETION_OWNER_CUSTODY_UNVERIFIED');
      if (family === 'jobs-and-spools' || family === 'diagnostics-and-audits') {
        await runtimeCheck();
      }
      await fresh();
    }
  }
}
