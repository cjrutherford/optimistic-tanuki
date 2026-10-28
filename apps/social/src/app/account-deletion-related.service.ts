import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DELETED_ACCOUNT_ID } from '@optimistic-tanuki/models';
import { SocialDeletionPlan } from './account-deletion-content.service';

const LIMIT = 10000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canon = (v: unknown) =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';
/** Private owner helper. The caller validates grants and supplies a fenced transaction. */
@Injectable()
export class SocialAccountDeletionRelatedService {
  private async candidates(
    manager: EntityManager,
    table: string,
    predicate: string,
    account: string,
    profiles: readonly string[],
    columns: readonly string[] = []
  ) {
    if (
      !UUID.test(account) ||
      profiles.length > 999 ||
      profiles.some((id) => !UUID.test(id))
    )
      throw Error('SOCIAL_DELETION_IDENTITY_INVALID');
    const rows = await manager.query(
      `SELECT id${columns
        .map((c) => `,"${c}"`)
        .join(
          ''
        )} FROM "${table}" WHERE (${predicate}) AND $1::text IS NOT NULL AND $2::text[] IS NOT NULL ORDER BY id LIMIT ${
        LIMIT + 1
      }`,
      [account, profiles]
    );
    if (
      !Array.isArray(rows) ||
      rows.length > LIMIT ||
      rows.some((row) => !UUID.test(row?.id))
    )
      throw Error('SOCIAL_DELETION_RELATED_BOUND');
    return rows as Record<string, any>[];
  }
  async inspect(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const pair = (accountCol: string, profileCol: string) =>
      `lower(btrim("${accountCol}"::text))=$1 OR lower(btrim("${profileCol}"::text))=ANY($2::text[])`;
    const candidates = await this.candidates(
      manager,
      'election_candidate',
      pair('userId', 'profileId'),
      account,
      profiles,
      ['userId', 'profileId', 'electionId']
    );
    const votes = await this.candidates(
      manager,
      'election_vote',
      pair('voterId', 'voterProfileId'),
      account,
      profiles,
      ['voterId', 'voterProfileId', 'candidateId']
    );
    for (const [rows, a, p] of [
      [candidates, 'userId', 'profileId'],
      [votes, 'voterId', 'voterProfileId'],
    ] as const) {
      if (
        rows.some(
          (row) =>
            canon(row[a]) !== account || !profiles.includes(canon(row[p]))
        )
      )
        throw Error('SOCIAL_DELETION_ELECTION_BINDING_CONFLICT');
    }
    const pages = await this.candidates(
      manager,
      'business_page_contents',
      '"ownerId"=$1::uuid',
      account,
      profiles
    );
    await this.candidates(
      manager,
      'community_sponsorship_contents',
      '"userId"=$1::uuid',
      account,
      profiles
    );
    await this.candidates(
      manager,
      'guardian_published_asset_grant',
      'lower(btrim("actorUserId"::text))=$1 OR lower(btrim("dependentProfileId"::text))=ANY($2::text[])',
      account,
      profiles
    );
    return { candidates, votes, pageIds: pages.map((row) => row['id']) };
  }
  async erase(
    manager: EntityManager,
    account: string,
    profiles: readonly string[],
    plan: SocialDeletionPlan
  ) {
    const selected = await this.inspect(manager, account, profiles);
    await manager.query(
      'DELETE FROM guardian_published_asset_grant WHERE lower(btrim("actorUserId"::text))=$1 OR lower(btrim("dependentProfileId"::text))=ANY($2::text[])',
      [account, profiles]
    );
    await manager.query(
      'DELETE FROM community_sponsorship_contents WHERE "userId"=$1::uuid',
      [account]
    );
    await manager.query(
      'UPDATE business_theme_contents SET "customCss"=NULL,"customFontFamily"=NULL WHERE "businessPageId"=ANY($1::uuid[])',
      [selected.pageIds]
    );
    await manager.query(
      'UPDATE business_page_contents SET "ownerId"=$2::uuid,phone=NULL,email=NULL,address=NULL WHERE id=ANY($1::uuid[])',
      [selected.pageIds, DELETED_ACCOUNT_ID]
    );
    await manager.query('DELETE FROM election_vote WHERE id=ANY($1::uuid[])', [
      selected.votes.map((row) => row['id']),
    ]);
    const candidateIds = selected.candidates.map((row) => row['id']);
    await manager.query(
      'UPDATE election_vote SET "candidateUserId"=$2::uuid WHERE "candidateUserId"=$1::uuid',
      [account, DELETED_ACCOUNT_ID]
    );
    await manager.query(
      'UPDATE election_candidate SET "userId"=$2::uuid,"profileId"=$2::uuid,"isWithdrawn"=true WHERE id=ANY($1::uuid[])',
      [candidateIds, DELETED_ACCOUNT_ID]
    );
    // The physical candidate FK cascades ballots. Keep an inert candidate whenever a counterpart ballot needs it.
    await manager.query(
      'DELETE FROM election_candidate c WHERE c.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM election_vote v WHERE v."candidateId"=c.id)',
      [candidateIds]
    );
    const touched = [
      ...new Set([
        ...candidateIds,
        ...selected.votes.map((row) => row['candidateId']),
      ]),
    ];
    await manager.query(
      'UPDATE election_candidate c SET "voteCount"=(SELECT count(*) FROM election_vote v WHERE v."candidateId"=c.id) WHERE c.id=ANY($1::uuid[])',
      [touched]
    );
    await manager.query(
      'UPDATE community_election SET "initiatedBy"=CASE WHEN lower(btrim("initiatedBy"::text))=$1 THEN NULL ELSE "initiatedBy" END,"winnerId"=CASE WHEN "winnerId"=$1::uuid THEN NULL ELSE "winnerId" END,"winnerProfileId"=CASE WHEN "winnerProfileId"=ANY($2::uuid[]) THEN NULL ELSE "winnerProfileId" END WHERE lower(btrim("initiatedBy"::text))=$1 OR "winnerId"=$1::uuid OR "winnerProfileId"=ANY($2::uuid[])',
      [account, profiles]
    );
    for (const table of ['post', 'comment'])
      await manager.query(
        `UPDATE "${table}" SET "moderatedBy"=NULL,"moderationNotes"=NULL,"moderatedAt"=NULL WHERE lower(btrim("moderatedBy"::text))=ANY($1::text[])`,
        [profiles]
      );
    const subject =
      '("contentType"::text=\'post\' AND "contentId"=ANY($2::text[])) OR ("contentType"::text=\'comment\' AND "contentId"=ANY($3::text[])) OR ("contentType"::text=\'profile\' AND lower(btrim("contentId"::text))=ANY($1::text[]))';
    const reports = await manager.query(
      `SELECT id FROM content_report WHERE lower(btrim("reporterId"::text))=ANY($1::text[]) OR ${subject} LIMIT ${
        LIMIT + 1
      }`,
      [profiles, plan.postIds, plan.commentIds]
    );
    if (!Array.isArray(reports) || reports.length > LIMIT)
      throw Error('SOCIAL_DELETION_RELATED_BOUND');
    await manager.query(
      `UPDATE content_report SET "reporterId"=CASE WHEN lower(btrim("reporterId"::text))=ANY($1::text[]) THEN $4 ELSE "reporterId" END,"contentId"=CASE WHEN ${subject} THEN $4 ELSE "contentId" END,description=NULL,"adminNotes"=NULL,"workspaceId"=NULL WHERE id=ANY($5::uuid[])`,
      [
        profiles,
        plan.postIds,
        plan.commentIds,
        DELETED_ACCOUNT_ID,
        reports.map((r) => r.id),
      ]
    );
    await manager.query(
      `UPDATE content_moderation_action SET "subjectId"=CASE WHEN ("subjectType"='post' AND "subjectId"=ANY($2::text[])) OR ("subjectType"='comment' AND "subjectId"=ANY($3::text[])) OR ("subjectType"='profile' AND lower(btrim("subjectId"::text))=ANY($1::text[])) THEN NULL ELSE "subjectId" END,"reportId"=CASE WHEN "reportId"=ANY($4::text[]) THEN NULL ELSE "reportId" END,"workspaceId"=NULL,details='{}'::jsonb WHERE ("subjectType"='post' AND "subjectId"=ANY($2::text[])) OR ("subjectType"='comment' AND "subjectId"=ANY($3::text[])) OR ("subjectType"='profile' AND lower(btrim("subjectId"::text))=ANY($1::text[])) OR "reportId"=ANY($4::text[])`,
      [profiles, plan.postIds, plan.commentIds, reports.map((r) => r.id)]
    );
  }
  async readback(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const result = await this.inspect(manager, account, profiles);
    if (
      result.candidates.length ||
      result.votes.length ||
      result.pageIds.length
    )
      throw Error('SOCIAL_DELETION_RELATED_REMAINS');
    const checks: Record<string, string> = {
      guardian_published_asset_grant:
        'lower(btrim("actorUserId"::text))=$1 OR lower(btrim("dependentProfileId"::text))=ANY($2::text[])',
      community_sponsorship_contents: '"userId"=$1::uuid',
      election_vote: '"candidateUserId"=$1::uuid',
      community_election:
        'lower(btrim("initiatedBy"::text))=$1 OR "winnerId"=$1::uuid OR "winnerProfileId"=ANY($2::uuid[])',
      content_report:
        'lower(btrim("reporterId"::text))=ANY($2::text[]) OR ("contentType"::text=\'profile\' AND lower(btrim("contentId"::text))=ANY($2::text[]))',
      post: 'lower(btrim("moderatedBy"::text))=ANY($2::text[])',
      comment: 'lower(btrim("moderatedBy"::text))=ANY($2::text[])',
    };
    for (const [table, predicate] of Object.entries(checks))
      if (
        (await this.candidates(manager, table, predicate, account, profiles))
          .length
      )
        throw Error('SOCIAL_DELETION_RELATED_REMAINS');
  }
}
