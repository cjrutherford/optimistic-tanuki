import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AccountDeletionAction,
  DELETED_ACCOUNT_ID,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { ForumAuditErasureService } from './audit-erasure.service';
import { FORUM_DELETION_IDENTITIES } from './account-deletion-policy';
import { validateForumDispositions } from './forum-account-export-dispositions';
import inventory from './forum-account-export-dispositions.json';
const LIMIT = 10000,
  UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonical = (v: unknown) =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';
@Injectable()
export class ForumAccountDeletionOwnerService {
  constructor(
    @Inject('FORUM_CONNECTION') private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient,
    private readonly audit: ForumAuditErasureService
  ) {}
  private async select(
    manager: EntityManager,
    table: string,
    predicate: string,
    parameters: unknown[],
    columns: string[] = []
  ) {
    const rows = await manager.query(
      `SELECT id${columns
        .map((c) => `,"${c}"`)
        .join('')} FROM "${table}" WHERE ${predicate} ORDER BY id LIMIT ${
        LIMIT + 1
      }`,
      parameters
    );
    if (
      !Array.isArray(rows) ||
      rows.length > LIMIT ||
      rows.some((r) => !UUID.test(r?.id))
    )
      throw Error('FORUM_DELETION_ROW_BOUND');
    return rows as Record<string, any>[];
  }
  private async inspect(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const plan: Record<string, string[]> = {};
    for (const table of ['topic', 'thread', 'forum_post']) {
      const rows = await this.select(
        manager,
        table,
        'lower(btrim("userId"))=$1 OR lower(btrim("profileId"))=ANY($2::text[])',
        [account, profiles],
        ['userId', 'profileId']
      );
      if (
        rows.some(
          (row) =>
            canonical(row['userId']) !== account ||
            !profiles.includes(canonical(row['profileId']))
        )
      )
        throw Error('FORUM_DELETION_BINDING_CONFLICT');
      plan[table] = rows.map((row) => row['id']);
    }
    return plan;
  }
  private async counts(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    let remaining = 0;
    for (const [table, fields] of Object.entries(FORUM_DELETION_IDENTITIES)) {
      if (!fields.length) continue;
      const predicate = fields
        .map(
          ([column, kind]) =>
            `lower(btrim("${column}"::text))${
              kind === 'account' ? '=$1' : '=ANY($2::text[])'
            }`
        )
        .join(' OR ');
      const rows = await manager.query(
        `SELECT count(*)::text AS n FROM "${table}" WHERE (${predicate}) AND $1::text IS NOT NULL AND $2::text[] IS NOT NULL`,
        [account, profiles]
      );
      const raw = rows?.[0]?.n;
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        typeof raw !== 'string' ||
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) > LIMIT
      )
        throw Error('FORUM_DELETION_READBACK_INVALID');
      remaining += Number(raw);
    }
    return remaining;
  }
  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true; remaining: number }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'forum' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('FORUM_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(grant, 'forum', action);
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('FORUM_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'forum', action)).scope
        ) !== JSON.stringify(scope)
      )
        throw Error('FORUM_DELETION_SCOPE_CHANGED');
    };
    let remaining = await this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout='5s'");
      await manager.query("SET LOCAL statement_timeout='12s'");
      const catalog = await manager.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      if (
        validateForumDispositions(
          this.database.entityMetadatas,
          inventory,
          catalog
        ).length
      )
        throw Error('FORUM_DELETION_CATALOG_DRIFT');
      await installDeletionWriteFence(manager, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await manager.query(
        "SELECT set_config('ot.deletion_operation',$1,true)",
        [grant.operationId]
      );
      await fresh();
      await this.counts(manager, grant.accountId, profiles);
      const plan = await this.inspect(manager, grant.accountId, profiles);
      if (action === 'erase') {
        const reports = await this.select(
          manager,
          'forum_report',
          'lower(btrim("reporterId"))=ANY($1::text[]) OR ("contentType"=\'thread\' AND "contentId"=ANY($2::text[])) OR ("contentType"=\'post\' AND "contentId"=ANY($3::text[]))',
          [profiles, plan['thread'], plan['forum_post']]
        );
        const links = await manager.query(
          `SELECT "forumLinkId" FROM forum_post_links_forum_link WHERE "forumPostId"=ANY($1::uuid[]) LIMIT ${
            LIMIT + 1
          }`,
          [plan['forum_post']]
        );
        if (
          !Array.isArray(links) ||
          links.length > LIMIT ||
          links.some((r) => !UUID.test(r.forumLinkId))
        )
          throw Error('FORUM_DELETION_LINK_BOUND');
        await manager.query(
          'UPDATE forum_moderation_action SET "subjectId"=CASE WHEN ("subjectType"=\'thread\' AND "subjectId"=ANY($1::text[])) OR ("subjectType"=\'post\' AND "subjectId"=ANY($2::text[])) THEN NULL ELSE "subjectId" END,details=\'{}\'::jsonb WHERE ("subjectType"=\'thread\' AND "subjectId"=ANY($1::text[])) OR ("subjectType"=\'post\' AND "subjectId"=ANY($2::text[])) OR (action=\'report_status\' AND details->>\'reportId\'=ANY($3::text[]))',
          [plan['thread'], plan['forum_post'], reports.map((r) => r['id'])]
        );
        await manager.query(
          'UPDATE forum_report SET "reporterId"=CASE WHEN lower(btrim("reporterId"))=ANY($1::text[]) THEN $4 ELSE "reporterId" END,"contentId"=CASE WHEN ("contentType"=\'thread\' AND "contentId"=ANY($2::text[])) OR ("contentType"=\'post\' AND "contentId"=ANY($3::text[])) THEN $4 ELSE "contentId" END,description=NULL,"adminNotes"=NULL WHERE id=ANY($5::uuid[])',
          [
            profiles,
            plan['thread'],
            plan['forum_post'],
            DELETED_ACCOUNT_ID,
            reports.map((r) => r['id']),
          ]
        );
        for (const table of ['thread', 'forum_post'])
          await manager.query(
            `UPDATE "${table}" SET "moderatedBy"=NULL,"moderationNotes"=NULL,"moderatedAt"=NULL WHERE lower(btrim("moderatedBy"))=ANY($1::text[])`,
            [profiles]
          );
        await manager.query(
          'DELETE FROM forum_post_links_forum_link WHERE "forumPostId"=ANY($1::uuid[])',
          [plan['forum_post']]
        );
        await manager.query(
          'DELETE FROM forum_link l WHERE l.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM forum_post_links_forum_link j WHERE j."forumLinkId"=l.id)',
          [[...new Set(links.map((r) => r.forumLinkId))]]
        );
        await manager.query('DELETE FROM forum_post WHERE id=ANY($1::uuid[])', [
          plan['forum_post'],
        ]);
        await manager.query(
          'UPDATE thread SET title=\'Deleted account\',description=\'\',content=\'Deleted account\',"userId"=$2,"profileId"=$2,"moderationNotes"=NULL,"moderatedBy"=NULL,"moderatedAt"=NULL WHERE id=ANY($1::uuid[])',
          [plan['thread'], DELETED_ACCOUNT_ID]
        );
        await manager.query(
          'DELETE FROM thread t WHERE t.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM forum_post p WHERE p."threadId"=t.id)',
          [plan['thread']]
        );
        await manager.query(
          'UPDATE topic SET title=\'Deleted account\',description=\'\',"userId"=$2,"profileId"=$2 WHERE id=ANY($1::uuid[])',
          [plan['topic'], DELETED_ACCOUNT_ID]
        );
        await manager.query(
          'DELETE FROM topic t WHERE t.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM thread h WHERE h."topicId"=t.id)',
          [plan['topic']]
        );
      }
      return this.counts(manager, grant.accountId, profiles);
    });
    if (action === 'erase') {
      const receipt = await this.audit.eraseParticipation(
        { accountId: grant.accountId, profileIds: profiles },
        grant.operationId
      );
      if (!receipt.allDeclaredSourcesVerified)
        throw Error('FORUM_DELETION_AUDIT_UNVERIFIED');
    }
    if (action !== 'fence') {
      remaining = await this.database.transaction((m) =>
        this.counts(m, grant.accountId, profiles)
      );
      if (remaining) throw Error('FORUM_DELETION_READBACK_NONEMPTY');
    }
    await fresh();
    return { verified: true, remaining };
  }
}
