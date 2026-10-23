import { FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';
import {
  projectForumContent,
  projectForumReference,
} from './account-export-content';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORDED = {
  attribution: 'recorded-unverified',
  consent: 'not-inferred',
};
const boundedColumn = (field: string, max: number) =>
  `left(${field}::text,${max + 1})`;
const col = (name: string, max: number, alias = name, prefix = 'r') =>
  `${boundedColumn(`${prefix}."${name}"`, max)} AS "${alias}"`;
function text(value: unknown, max: number, allowEmpty = true): string {
  if (
    typeof value !== 'string' ||
    Array.from(value).length > max ||
    (!allowEmpty && !value.trim())
  )
    throw new Error('FORUM_EXPORT_INVALID_TEXT');
  return value;
}
function id(value: unknown): string {
  const valueText = text(value, 36);
  if (!UUID.test(valueText)) throw new Error('FORUM_EXPORT_INVALID_ID');
  return valueText.toLowerCase();
}
function enumeration(value: unknown, allowed: readonly string[]): string {
  const valueText = text(value, 32);
  if (!allowed.includes(valueText))
    throw new Error('FORUM_EXPORT_UNKNOWN_ENUM');
  return valueText;
}
function timestamp(value: unknown): string {
  const raw = value instanceof Date ? value.toISOString() : text(value, 64);
  const normalized = raw.replace(' ', 'T');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?$/.test(
      normalized
    )
  )
    throw new Error('FORUM_EXPORT_INVALID_TIMESTAMP');
  const result = new Date(
    /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized + 'Z'
  );
  if (!Number.isFinite(result.getTime()))
    throw new Error('FORUM_EXPORT_INVALID_TIMESTAMP');
  return result.toISOString();
}
const own = (profileTable: string, alias = 'r') =>
  `lower(${alias}."userId"::text)=$1 AND EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE lower(identities.id::text)=lower(${alias}."profileId"::text))`;
const profileOwned = (profileTable: string, field: string) =>
  `$1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE lower(identities.id::text)=lower(r."${field}"::text))`;
const cursor = (key = 'r.id::text') =>
  `($2::text IS NULL OR ${key} COLLATE "C">$2 COLLATE "C") ORDER BY ${key} COLLATE "C" LIMIT $3`;
function envelope(row: Record<string, unknown>) {
  return {
    id: id(row.id),
    appScope: text(row.appScope, 256, false),
    createdAt: timestamp(row.createdAt),
    ...RECORDED,
  };
}
function authored(
  source: string,
  table: string,
  profileTable: string
): AccountExportPostgresSource {
  const fields = [
    col('id', 36),
    col('userId', 36),
    col('profileId', 36),
    col('appScope', 256),
    col('createdAt', 64),
    col('updatedAt', 64),
  ];
  if (source !== 'ForumPost')
    fields.push(
      col('title', 100000),
      col('description', 100000),
      col('visibility', 32)
    );
  if (source !== 'Topic')
    fields.push(
      col('content', 100000),
      col(source === 'Thread' ? 'topicId' : 'threadId', 36)
    );
  if (source === 'ForumPost') fields.push('r."isEdited"');
  return {
    source,
    sql: `SELECT ${fields.join(',')} FROM "${table}" r WHERE ${own(
      profileTable
    )} AND ${cursor()}`,
    project: (row, accountId) => {
      const userId = id(row.userId);
      if (userId !== id(accountId))
        throw new Error('FORUM_EXPORT_IDENTITY_MISMATCH');
      const result: Record<string, unknown> = {
        ...envelope(row),
        userId,
        profileId: id(row.profileId),
        updatedAt: timestamp(row.updatedAt),
      };
      if (source !== 'ForumPost')
        Object.assign(result, {
          title: projectForumContent(row.title),
          description: projectForumContent(row.description),
          visibility: enumeration(row.visibility, ['public', 'private']),
        });
      if (source !== 'Topic')
        Object.assign(result, {
          content: projectForumContent(row.content),
          [source === 'Thread' ? 'topicId' : 'threadId']: id(
            row[source === 'Thread' ? 'topicId' : 'threadId']
          ),
        });
      if (source === 'ForumPost') {
        if (typeof row.isEdited !== 'boolean')
          throw new Error('FORUM_EXPORT_INVALID_BOOLEAN');
        result.isEdited = row.isEdited;
      }
      return result;
    },
  };
}
function links(profileTable: string): AccountExportPostgresSource {
  const key = `concat(p.id::text, ':', l.id::text)`;
  return {
    source: 'ForumLink',
    sql: `SELECT ${key} AS id,${col('id', 36, 'postId', 'p')},${col(
      'id',
      36,
      'linkId',
      'l'
    )},${col('appScope', 256, 'appScope', 'p')},${col(
      'appScope',
      256,
      'linkScope',
      'l'
    )},${col('url', 2048, 'url', 'l')},${col(
      'createdAt',
      64,
      'createdAt',
      'l'
    )} FROM forum_post_links_forum_link j JOIN forum_post p ON p.id=j."forumPostId" JOIN forum_link l ON l.id=j."forumLinkId" WHERE ${own(
      profileTable,
      'p'
    )} AND ${cursor(key)}`,
    project: (row) => {
      const postId = id(row.postId),
        linkId = id(row.linkId);
      const appScope = text(row.appScope, 256, false);
      if (appScope !== text(row.linkScope, 256, false))
        throw new Error('FORUM_EXPORT_LINK_SCOPE_MISMATCH');
      if (row.id !== `${postId}:${linkId}`)
        throw new Error('FORUM_EXPORT_INVALID_ASSOCIATION');
      return {
        id: row.id,
        postId,
        linkId,
        appScope,
        reference: projectForumReference(text(row.url, 2048, false)),
        createdAt: timestamp(row.createdAt),
        ...RECORDED,
      };
    },
  };
}
function receipt(
  source: 'ForumReport' | 'ForumModerationAction',
  profileTable: string
): AccountExportPostgresSource {
  const report = source === 'ForumReport',
    actor = report ? 'reporterId' : 'actorProfileId';
  const names = [
    'id',
    actor,
    'appScope',
    'createdAt',
    ...(report
      ? ['contentType', 'contentId', 'reason', 'status']
      : ['action', 'subjectType', 'subjectId']),
  ];
  const fields = names.map((name) =>
    col(
      name,
      name === 'appScope'
        ? 256
        : name === 'createdAt'
        ? 64
        : ['id', actor, 'contentId', 'subjectId'].includes(name)
        ? 36
        : 32
    )
  );
  return {
    source,
    sql: `SELECT ${fields.join(',')} FROM ${
      report ? 'forum_report' : 'forum_moderation_action'
    } r WHERE ${profileOwned(profileTable, actor)} AND ${cursor()}`,
    project: (row) => {
      const scope =
        report && row.appScope === null ? null : text(row.appScope, 256, false);
      const result: Record<string, unknown> = {
        id: id(row.id),
        appScope: scope,
        createdAt: timestamp(row.createdAt),
        ...RECORDED,
      };
      if (report)
        Object.assign(result, {
          reporterProfileId: id(row.reporterId),
          contentType: enumeration(row.contentType, ['thread', 'post']),
          targetId: id(row.contentId),
          reason: enumeration(row.reason, [
            'spam',
            'harassment',
            'hate_speech',
            'violence',
            'misinformation',
            'inappropriate',
            'other',
          ]),
          status: enumeration(row.status, [
            'pending',
            'reviewed',
            'actioned',
            'dismissed',
          ]),
          scopeAttribution: scope === null ? 'unknown' : 'recorded',
        });
      else
        Object.assign(result, {
          actorProfileId: id(row.actorProfileId),
          action: enumeration(row.action, [
            'report_status',
            'content_moderation',
          ]),
          subjectType: enumeration(row.subjectType, ['thread', 'post']),
          subjectId: id(row.subjectId),
        });
      return result;
    },
  };
}
export function createForumAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('FORUM_EXPORT_INVALID_PROFILE_TABLE');
  const sources = [
    authored('Topic', 'topic', profileTable),
    authored('Thread', 'thread', profileTable),
    authored('ForumPost', 'forum_post', profileTable),
    links(profileTable),
    receipt('ForumReport', profileTable),
    receipt('ForumModerationAction', profileTable),
  ];
  if (
    sources.some(
      (source, index) =>
        source.source !== FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES[index]
    )
  )
    throw new Error('FORUM_ACCOUNT_EXPORT_SOURCE_REGISTRY_MISMATCH');
  return sources;
}
