import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DELETED_ACCOUNT_ID } from '@optimistic-tanuki/models';
export interface SocialDeletionPlan {
  postIds: string[];
  commentIds: string[];
  pollIds: string[];
  eventIds: string[];
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMIT = 10000,
  FIELD_BYTES = 65536,
  TOTAL_BYTES = 16 * 1024 * 1024;
const canonical = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
function validate(account: string, profiles: readonly string[]) {
  if (
    !UUID.test(account) ||
    account !== canonical(account) ||
    !Array.isArray(profiles) ||
    profiles.length > 999 ||
    new Set(profiles).size !== profiles.length ||
    profiles.some((id) => !UUID.test(id) || id !== canonical(id))
  )
    throw Error('SOCIAL_DELETION_IDENTITY_INVALID');
}
function rows(value: unknown): Record<string, any>[] {
  if (!Array.isArray(value) || value.length > LIMIT)
    throw Error('SOCIAL_DELETION_ROW_BOUND');
  return value;
}
function ids(value: Record<string, any>[]): string[] {
  const result = value.map((row) => row['id']);
  if (
    result.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
    new Set(result).size !== result.length
  )
    throw Error('SOCIAL_DELETION_ROW_ID_INVALID');
  return result;
}

export function decodePollBallots(
  raw: unknown,
  optionCount = 10000
): { userId: string; optionIndices: number[] }[] {
  if (raw === null || raw === '') return [];
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > FIELD_BYTES)
    throw Error('SOCIAL_DELETION_POLL_BYTES_LIMIT');
  let value: unknown;
  try {
    value = JSON.parse(`[${raw}]`);
  } catch {
    throw Error('SOCIAL_DELETION_POLL_VOTES_INVALID');
  }
  if (!Array.isArray(value) || value.length > 10000)
    throw Error('SOCIAL_DELETION_POLL_VOTES_LIMIT');
  for (const ballot of value) {
    if (
      !ballot ||
      typeof ballot !== 'object' ||
      Array.isArray(ballot) ||
      Object.keys(ballot).sort().join(',') !== 'optionIndices,userId' ||
      typeof ballot.userId !== 'string' ||
      !UUID.test(ballot.userId) ||
      !Array.isArray(ballot.optionIndices) ||
      ballot.optionIndices.length > 1000 ||
      !ballot.optionIndices.every(
        (i: unknown) =>
          Number.isSafeInteger(i) && Number(i) >= 0 && Number(i) < optionCount
      )
    )
      throw Error('SOCIAL_DELETION_POLL_BALLOT_INVALID');
  }
  return value;
}
export function stripEventAttendance(
  raw: unknown,
  profiles: readonly string[]
): string[] {
  if (raw === null || raw === '') return [];
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > FIELD_BYTES)
    throw Error('SOCIAL_DELETION_EVENT_BYTES_LIMIT');
  const values = raw.split(',');
  if (values.length > 10000 || values.some((id) => !UUID.test(id.trim())))
    throw Error('SOCIAL_DELETION_EVENT_ATTENDANCE_INVALID');
  return values.filter((id) => !profiles.includes(canonical(id)));
}

@Injectable()
export class SocialAccountDeletionContentService {
  async inspect(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ): Promise<SocialDeletionPlan> {
    validate(account, profiles);
    const found: Record<string, string[]> = {};
    for (const table of [
      'post',
      'comment',
      'poll',
      'event',
      'vote',
      'reaction',
    ]) {
      const selected = rows(
        await manager.query(
          `SELECT id,"userId","profileId" FROM "${table}" WHERE lower(btrim("userId"::text))=$1 OR lower(btrim("profileId"::text))=ANY($2::text[]) ORDER BY id LIMIT ${
            LIMIT + 1
          }`,
          [account, profiles]
        )
      );
      if (
        selected.some(
          (row) =>
            canonical(row['userId']) !== account ||
            !profiles.includes(canonical(row['profileId']))
        )
      )
        throw Error('SOCIAL_DELETION_IDENTITY_CONFLICT');
      if (table !== 'vote' && table !== 'reaction')
        found[table] = ids(selected);
    }
    return {
      postIds: found['post'],
      commentIds: found['comment'],
      pollIds: found['poll'],
      eventIds: found['event'],
    };
  }
  private async polls(
    manager: EntityManager,
    account: string,
    owned: string[]
  ) {
    const selected = rows(
      await manager.query(
        `WITH candidates AS (SELECT id,votes,options,COALESCE(octet_length(votes),0) AS vb,octet_length(options) AS ob,sum(COALESCE(octet_length(votes),0)+octet_length(options)) OVER() AS total FROM poll WHERE id=ANY($1::uuid[]) OR lower(votes) LIKE '%'||$2||'%') SELECT id,vb,ob,total::text,CASE WHEN total<=${TOTAL_BYTES} AND vb<=${FIELD_BYTES} THEN votes END AS votes,CASE WHEN total<=${TOTAL_BYTES} AND ob<=${FIELD_BYTES} THEN options END AS options FROM candidates ORDER BY id LIMIT ${
          LIMIT + 1
        }`,
        [owned, account]
      )
    );
    return selected.map((row) => {
      if (
        Number(row['total']) > TOTAL_BYTES ||
        Number(row['vb']) > FIELD_BYTES ||
        Number(row['ob']) > FIELD_BYTES ||
        typeof row['options'] !== 'string'
      )
        throw Error('SOCIAL_DELETION_POLL_BYTES_LIMIT');
      const options = row['options'] === '' ? [] : row['options'].split(',');
      if (options.length > 1000)
        throw Error('SOCIAL_DELETION_POLL_OPTIONS_LIMIT');
      return {
        id: row['id'] as string,
        options,
        ballots: decodePollBallots(row['votes'], options.length),
      };
    });
  }
  private async events(
    manager: EntityManager,
    profiles: readonly string[],
    owned: string[]
  ) {
    const selected = rows(
      await manager.query(
        `WITH candidates AS (SELECT id,"attendeeIds",COALESCE(octet_length("attendeeIds"),0) AS bytes,sum(COALESCE(octet_length("attendeeIds"),0)) OVER() AS total FROM event WHERE id=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM unnest(string_to_array(COALESCE("attendeeIds",''),',')) x WHERE lower(btrim(x))=ANY($2::text[]))) SELECT id,bytes,total::text,CASE WHEN total<=${TOTAL_BYTES} AND bytes<=${FIELD_BYTES} THEN "attendeeIds" END AS "attendeeIds" FROM candidates ORDER BY id LIMIT ${
          LIMIT + 1
        }`,
        [owned, profiles]
      )
    );
    return selected.map((row) => {
      if (
        Number(row['total']) > TOTAL_BYTES ||
        Number(row['bytes']) > FIELD_BYTES
      )
        throw Error('SOCIAL_DELETION_EVENT_BYTES_LIMIT');
      return {
        id: row['id'] as string,
        attendees: stripEventAttendance(row['attendeeIds'], profiles),
      };
    });
  }
  async erase(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ): Promise<SocialDeletionPlan> {
    const plan = await this.inspect(manager, account, profiles);
    // Validate every selected compound field before the first mutation.
    const polls = await this.polls(manager, account, plan.pollIds),
      events = await this.events(manager, profiles, plan.eventIds);
    for (const table of ['attachment', 'social_components', 'post_link'])
      rows(
        await manager.query(
          `SELECT "postId" FROM "${table}" WHERE "postId"=ANY($1::uuid[]) LIMIT ${
            LIMIT + 1
          }`,
          [plan.postIds]
        )
      );
    for (const table of ['vote', 'reaction'])
      await manager.query(
        `DELETE FROM "${table}" WHERE lower(btrim("userId"::text))=$1 AND lower(btrim("profileId"::text))=ANY($2::text[])`,
        [account, profiles]
      );
    await manager.query(
      'UPDATE saved_item SET "itemTitle"=NULL WHERE ("itemType"::text=\'post\' AND "itemId"=ANY($1::text[])) OR ("itemType"::text=\'comment\' AND "itemId"=ANY($2::text[]))',
      [plan.postIds, plan.commentIds]
    );
    await manager.query(
      'UPDATE comment SET content=\'Deleted account\',"userId"=$2,"profileId"=$2,"moderationNotes"=NULL,"moderatedBy"=NULL,"moderatedAt"=NULL WHERE id=ANY($1::uuid[])',
      [plan.commentIds, DELETED_ACCOUNT_ID]
    );
    await manager.query(
      `WITH RECURSIVE keep(id) AS (SELECT c.id FROM comment c WHERE c.id=ANY($1::uuid[]) AND (EXISTS(SELECT 1 FROM comment f WHERE f."parentId"=c.id AND NOT(f.id=ANY($1::uuid[]))) OR EXISTS(SELECT 1 FROM vote v WHERE v."commentId"=c.id) OR EXISTS(SELECT 1 FROM reaction r WHERE r."commentId"=c.id) OR EXISTS(SELECT 1 FROM saved_item s WHERE s."itemType"::text='comment' AND s."itemId"=c.id::text)) UNION SELECT c."parentId" FROM comment c JOIN keep k ON c.id=k.id WHERE c."parentId"=ANY($1::uuid[])) DELETE FROM comment c WHERE c.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM keep k WHERE k.id=c.id)`,
      [plan.commentIds]
    );
    await manager.query(
      'DELETE FROM attachment WHERE "postId"=ANY($1::uuid[])',
      [plan.postIds]
    );
    await manager.query(
      'DELETE FROM social_components WHERE "postId"=ANY($1::uuid[])',
      [plan.postIds]
    );
    const links = rows(
      await manager.query(
        'SELECT "linkId" FROM post_link WHERE "postId"=ANY($1::uuid[])',
        [plan.postIds]
      )
    );
    await manager.query(
      'DELETE FROM post_link WHERE "postId"=ANY($1::uuid[])',
      [plan.postIds]
    );
    const linkIds = [...new Set(links.map((row) => row['linkId']))];
    if (linkIds.some((id) => !Number.isSafeInteger(id)))
      throw Error('SOCIAL_DELETION_LINK_ID_INVALID');
    await manager.query(
      'DELETE FROM link l WHERE l.id=ANY($1::int[]) AND NOT EXISTS(SELECT 1 FROM post_link p WHERE p."linkId"=l.id)',
      [linkIds]
    );
    await manager.query(
      'UPDATE post SET title=\'Deleted account\',content=\'Deleted account\',"userId"=$2,"profileId"=$2,"moderationNotes"=NULL,"moderatedBy"=NULL,"moderatedAt"=NULL,"scheduledAt"=NULL,"isScheduled"=false WHERE id=ANY($1::uuid[])',
      [plan.postIds, DELETED_ACCOUNT_ID]
    );
    await manager.query(
      `DELETE FROM post p WHERE p.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM comment c WHERE c."postId"=p.id) AND NOT EXISTS(SELECT 1 FROM vote v WHERE v."postId"=p.id) AND NOT EXISTS(SELECT 1 FROM reaction r WHERE r."postId"=p.id) AND NOT EXISTS(SELECT 1 FROM business_page_contents b WHERE b."pinnedPostId"=p.id) AND NOT EXISTS(SELECT 1 FROM post_share s WHERE s."originalPostId"=p.id::text) AND NOT EXISTS(SELECT 1 FROM saved_item s WHERE s."itemType"::text='post' AND s."itemId"=p.id::text)`,
      [plan.postIds]
    );
    for (const row of polls) {
      const keep = row.ballots.filter(
          (ballot) => canonical(ballot.userId) !== account
        ),
        serialized = keep.map((b) => JSON.stringify(b)).join(',');
      if (plan.pollIds.includes(row.id)) {
        if (!keep.length)
          await manager.query('DELETE FROM poll WHERE id=$1', [row.id]);
        else
          await manager.query(
            'UPDATE poll SET question=\'Deleted account\',options=$2,votes=$3,"userId"=$4,"profileId"=$4,"isActive"=false WHERE id=$1',
            [
              row.id,
              row.options.map(() => 'Deleted choice').join(','),
              serialized,
              DELETED_ACCOUNT_ID,
            ]
          );
      } else
        await manager.query('UPDATE poll SET votes=$2 WHERE id=$1', [
          row.id,
          serialized || null,
        ]);
    }
    for (const row of events) {
      if (plan.eventIds.includes(row.id)) {
        if (!row.attendees.length)
          await manager.query('DELETE FROM event WHERE id=$1', [row.id]);
        else
          await manager.query(
            'UPDATE event SET title=\'Deleted account\',description=NULL,location=NULL,"locationUrl"=NULL,"coverImageUrl"=NULL,"userId"=$2,"profileId"=$2,status=\'cancelled\',"attendeeIds"=$3,"attendeeCount"=$4 WHERE id=$1',
            [
              row.id,
              DELETED_ACCOUNT_ID,
              row.attendees.join(','),
              row.attendees.length,
            ]
          );
      } else
        await manager.query(
          'UPDATE event SET "attendeeIds"=$2,"attendeeCount"=$3 WHERE id=$1',
          [row.id, row.attendees.join(',') || null, row.attendees.length]
        );
    }
    return plan;
  }
  async readback(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ): Promise<void> {
    validate(account, profiles);
    for (const table of [
      'post',
      'comment',
      'poll',
      'event',
      'vote',
      'reaction',
    ]) {
      const found = rows(
        await manager.query(
          `SELECT 1 FROM "${table}" WHERE lower(btrim("userId"::text))=$1 OR lower(btrim("profileId"::text))=ANY($2::text[]) LIMIT 1`,
          [account, profiles]
        )
      );
      if (found.length) throw Error('SOCIAL_DELETION_AUTHORSHIP_REMAINS');
    }
    for (const row of await this.polls(manager, account, []))
      if (row.ballots.some((ballot) => canonical(ballot.userId) === account))
        throw Error('SOCIAL_DELETION_POLL_BALLOT_REMAINS');
    const eventRows = await this.events(manager, profiles, []);
    if (eventRows.length) throw Error('SOCIAL_DELETION_ATTENDANCE_REMAINS');
  }
}
