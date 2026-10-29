import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DELETED_ACCOUNT_ID } from '@optimistic-tanuki/models';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LIMIT = 10000;
const canon = (v: unknown) =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';
const prof = (column: string) =>
  `lower(btrim("${column}"::text))=ANY($2::text[])`;
const acct = (column: string) => `lower(btrim("${column}"::text))=$1`;
const specs: Readonly<
  Record<string, { where: string; columns: readonly string[] }>
> = {
  saved_item: { where: prof('profileId'), columns: [] },
  post_share: { where: prof('sharedById'), columns: [] },
  follow_entity: {
    where: `${prof('followerId')} OR ${prof('followeeId')}`,
    columns: ['followerId', 'followeeId'],
  },
  user_block: {
    where: `${prof('blockerId')} OR ${prof('blockedId')}`,
    columns: ['blockerId', 'blockedId'],
  },
  user_mute: {
    where: `${prof('muterId')} OR ${prof('mutedId')}`,
    columns: ['muterId', 'mutedId'],
  },
  user_presence: { where: acct('userId'), columns: [] },
  search_history: { where: prof('profileId'), columns: [] },
  notification: {
    where: `${prof('recipientId')} OR ${prof(
      'senderId'
    )} OR ("resourceType"='profile' AND ${prof('resourceId')})`,
    columns: ['recipientId', 'senderId', 'resourceType', 'resourceId'],
  },
  community_member: {
    where: `${acct('userId')} OR ${prof('profileId')}`,
    columns: ['userId', 'profileId', 'communityId'],
  },
  community_invite: {
    where: `${acct('inviterId')} OR ${acct('inviteeId')}`,
    columns: [],
  },
  community: {
    where: `${acct('ownerId')} OR ${prof('ownerProfileId')} OR ${acct(
      'managerId'
    )} OR ${prof('managerProfileId')}`,
    columns: ['ownerId', 'ownerProfileId', 'managerId', 'managerProfileId'],
  },
};
@Injectable()
export class SocialAccountDeletionStateService {
  private validate(account: string, profiles: readonly string[]) {
    if (
      !UUID.test(account) ||
      !Array.isArray(profiles) ||
      profiles.length > 999 ||
      new Set(profiles).size !== profiles.length ||
      profiles.some((id) => !UUID.test(id))
    )
      throw Error('SOCIAL_DELETION_IDENTITY_INVALID');
  }
  private async candidates(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    this.validate(account, profiles);
    const found: Record<string, Record<string, any>[]> = {};
    for (const [table, spec] of Object.entries(specs)) {
      const rows = await manager.query(
        `SELECT id${spec.columns
          .map((c) => `,"${c}"`)
          .join('')} FROM "${table}" WHERE (${
          spec.where
        }) AND $1::text IS NOT NULL AND $2::text[] IS NOT NULL ORDER BY id LIMIT ${
          LIMIT + 1
        }`,
        [account, profiles]
      );
      if (
        !Array.isArray(rows) ||
        rows.length > LIMIT ||
        rows.some((row) => !UUID.test(row?.id)) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw Error('SOCIAL_DELETION_STATE_BOUND');
      found[table] = rows;
    }
    for (const row of found['community_member'])
      if (
        canon(row['userId']) !== account ||
        !profiles.includes(canon(row['profileId'])) ||
        !UUID.test(row['communityId'])
      )
        throw Error('SOCIAL_DELETION_MEMBERSHIP_BINDING_CONFLICT');
    for (const row of found['community']) {
      const owner = canon(row['ownerId']) === account,
        ownerProfile = profiles.includes(canon(row['ownerProfileId']));
      if (owner !== ownerProfile)
        throw Error('SOCIAL_DELETION_STEWARDSHIP_BINDING_CONFLICT');
      const managerOwn = canon(row['managerId']) === account,
        managerProfileOwn = profiles.includes(canon(row['managerProfileId']));
      if (
        (managerOwn && row['managerProfileId'] != null && !managerProfileOwn) ||
        (managerProfileOwn && row['managerId'] != null && !managerOwn)
      )
        throw Error('SOCIAL_DELETION_STEWARDSHIP_BINDING_CONFLICT');
    }
    return found;
  }
  async inspect(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const found = await this.candidates(manager, account, profiles);
    const communityIds = [
      ...new Set([
        ...found['community'].map((row) => row['id']),
        ...found['community_member'].map((row) => row['communityId']),
      ]),
    ].sort();
    if (communityIds.length > LIMIT) throw Error('SOCIAL_DELETION_STATE_BOUND');
    return { communityIds };
  }
  async erase(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ): Promise<void> {
    const found = await this.candidates(manager, account, profiles);
    const communityIds = [
      ...new Set([
        ...found['community'].map((row) => row['id']),
        ...found['community_member'].map((row) => row['communityId']),
      ]),
    ];
    if (communityIds.length > LIMIT) throw Error('SOCIAL_DELETION_STATE_BOUND');
    for (const table of [
      'saved_item',
      'post_share',
      'user_presence',
      'search_history',
      'community_member',
      'community_invite',
    ])
      await manager.query(`DELETE FROM "${table}" WHERE id=ANY($1::uuid[])`, [
        found[table].map((row) => row['id']),
      ]);
    for (const [table, actor, target] of [
      ['follow_entity', 'followerId', 'followeeId'],
      ['user_block', 'blockerId', 'blockedId'],
      ['user_mute', 'muterId', 'mutedId'],
    ]) {
      await manager.query(
        `DELETE FROM "${table}" WHERE lower(btrim("${actor}"::text))=ANY($1::text[])`,
        [profiles]
      );
      await manager.query(
        `UPDATE "${table}" SET "${target}"=$2${
          table === 'follow_entity' ? ',"isMutual"=false' : ''
        } WHERE lower(btrim("${target}"::text))=ANY($1::text[])`,
        [profiles, DELETED_ACCOUNT_ID]
      );
    }
    await manager.query(
      'DELETE FROM notification WHERE lower(btrim("recipientId"::text))=ANY($1::text[])',
      [profiles]
    );
    await manager.query(
      `UPDATE notification SET "senderId"=CASE WHEN lower(btrim("senderId"::text))=ANY($1::text[]) THEN NULL ELSE "senderId" END,title='Deleted account',body='',"resourceType"=NULL,"resourceId"=NULL,"actionUrl"=NULL WHERE lower(btrim("senderId"::text))=ANY($1::text[]) OR ("resourceType"='profile' AND lower(btrim("resourceId"::text))=ANY($1::text[]))`,
      [profiles]
    );
    await manager.query(
      'UPDATE community SET "ownerId"=$3,"ownerProfileId"=$3 WHERE lower(btrim("ownerId"::text))=$1 AND lower(btrim("ownerProfileId"::text))=ANY($2::text[])',
      [account, profiles, DELETED_ACCOUNT_ID]
    );
    await manager.query(
      'UPDATE community SET "managerId"=CASE WHEN lower(btrim("managerId"::text))=$1 THEN NULL ELSE "managerId" END,"managerProfileId"=CASE WHEN lower(btrim("managerProfileId"::text))=ANY($2::text[]) THEN NULL ELSE "managerProfileId" END WHERE lower(btrim("managerId"::text))=$1 OR lower(btrim("managerProfileId"::text))=ANY($2::text[])',
      [account, profiles]
    );
    await manager.query(
      `UPDATE community c SET "memberCount"=(SELECT count(*) FROM community_member m WHERE m."communityId"=c.id AND m.status='approved') WHERE c.id=ANY($1::uuid[])`,
      [communityIds]
    );
  }
  async readback(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ): Promise<void> {
    const found = await this.candidates(manager, account, profiles);
    if (Object.values(found).some((rows) => rows.length))
      throw Error('SOCIAL_DELETION_STATE_REMAINS');
  }
}
