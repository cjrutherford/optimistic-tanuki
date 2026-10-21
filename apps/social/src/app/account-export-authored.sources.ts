/** Bounded, explicitly projected Social authored-content sources for J24-A. */
export interface SocialCaptureSource {
  source: string;
  sql: string;
  project(
    row: Record<string, unknown>,
    accountId: string
  ): Record<string, unknown>;
}

export const SOCIAL_AUTHORED_SOURCES = [
  'Post',
  'Comment',
  'Reaction',
  'Vote',
  'Attachment',
  'Poll',
  'SocialComponent',
  'Link',
  'PostShare',
  'Event',
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = { text: 65_536, short: 4096, item: 2048, items: 100 };
const RECORDED =
  'Recorded attribution only: per-row origin, legacy authorship and consent are unverified. A current selector is not historical identity proof; never infer consent.';

function fail(): never {
  throw new Error('SOCIAL_ACCOUNT_EXPORT_INVALID_SOURCE_ROW');
}

export function boundedString(
  value: unknown,
  max = MAX.text,
  nullable = false
): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || Array.from(value).length > max)
    return fail();
  return value;
}

function checkedText(
  row: Record<string, unknown>,
  field: string,
  max = MAX.short,
  nullable = false
): string | null {
  const value = row[field];
  const length = row[`${field}Length`];
  if (value === null && nullable) return null;
  if (
    !Number.isSafeInteger(Number(length)) ||
    Number(length) > max ||
    typeof value !== 'string' ||
    Array.from(value).length !== Number(length)
  )
    return fail();
  return boundedString(value, max);
}

export function requiredId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,511}$/.test(value)
  )
    return fail();
  return value;
}

function entityId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value.trim())) return fail();
  return value.trim().toLowerCase();
}

export function timestamp(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') return fail();
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
    value
  )
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return fail();
  return date.toISOString();
}

export function safeUrl(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  const text = boundedString(value, MAX.short);
  try {
    const url = new URL(text);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return fail();
    return url.toString();
  } catch {
    return fail();
  }
}

function assetReference(value: unknown): string | null {
  if (value == null) return null;
  const locator = boundedString(value, MAX.short);
  if (UUID.test(locator)) return locator.toLowerCase();
  if (/^\/(?:api\/)?asset\/[0-9a-f-]{36}$/i.test(locator))
    return entityId(locator.split('/').at(-1));
  let url: URL;
  try {
    url = new URL(locator);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return fail();
  const match = url.pathname.match(/^\/(?:api\/)?asset\/([0-9a-f-]{36})$/i);
  return match ? entityId(match[1]) : null;
}

const textColumn = (alias: string, column: string, max = MAX.short) =>
  `left(${alias}."${column}"::text,${
    max + 1
  }) AS "${column}",char_length(${alias}."${column}"::text) AS "${column}Length"`;

function scalar(
  row: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = row[field];
  return out;
}

function projection(
  source: string,
  fields: readonly string[],
  options: {
    legacy?: boolean;
    references?: readonly string[];
    requiredReferences?: readonly string[];
    urls?: readonly string[];
    nullableUrls?: readonly string[];
    nullableStrings?: readonly string[];
    timestamps?: readonly string[];
    nullableTimestamps?: readonly string[];
    numericId?: boolean;
  }
): (
  row: Record<string, unknown>,
  accountId: string
) => Record<string, unknown> {
  return (row, accountId) => {
    const id = options.numericId ? String(row.id) : entityId(row.id);
    if (
      options.numericId &&
      (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))
    )
      return fail();
    const out: Record<string, unknown> = { id };
    const values = scalar(row, fields);
    for (const [key, value] of Object.entries(values)) {
      if (key === 'id') continue;
      if (key === 'userId' || key === 'profileId' || key === 'sharedById')
        out[key] = entityId(value);
      else if (options.urls?.includes(key))
        out[key] = safeUrl(value, options.nullableUrls?.includes(key));
      else if (options.timestamps?.includes(key)) out[key] = timestamp(value);
      else if (options.nullableTimestamps?.includes(key))
        out[key] = timestamp(value, true);
      else if (options.references?.includes(key)) {
        if (value == null && options.requiredReferences?.includes(key))
          return fail();
        out[key] = value == null ? null : entityId(value);
      } else if (typeof value === 'string') {
        const limit = [
          'content',
          'title',
          'question',
          'description',
          'comment',
        ].includes(key)
          ? MAX.text
          : MAX.short;
        const length = row[`${key}Length`];
        if (
          length === undefined ||
          !Number.isSafeInteger(Number(length)) ||
          Number(length) > limit ||
          Array.from(value).length !== Number(length)
        )
          return fail();
        out[key] = boundedString(value, limit, value === null);
      } else if (value === null && options.nullableStrings?.includes(key))
        out[key] = null;
      else if (
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      )
        out[key] = value;
      else return fail();
    }
    if (
      typeof row.userId === 'string' &&
      row.userId.trim().toLowerCase() !== accountId.toLowerCase()
    )
      return fail();
    if (typeof row.profileId === 'string') entityId(row.profileId);
    if (options.legacy) {
      out.attribution = 'recorded-unverified';
      out.consent = 'not-inferred';
    }
    return out;
  };
}

/** The only interpolated value is a generated, validated temporary identifier. */
export function createAuthoredSources(
  profileTable: string
): SocialCaptureSource[] {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(profileTable))
    throw new Error('invalid profile scope');
  const owned = (alias: string) =>
    `JOIN "${profileTable}" owned ON owned."id"::text=lower(btrim(${alias}."profileId"::text))`;
  const postOwned = `EXISTS (SELECT 1 FROM "post" p JOIN "${profileTable}" owned ON owned."id"::text=lower(btrim(p."profileId"::text)) WHERE lower(btrim(p."userId"::text))=$1 AND p."id"=`;
  const sources: SocialCaptureSource[] = [
    {
      source: 'Post',
      sql: `SELECT p."id"::text AS "id",${textColumn(
        'p',
        'title',
        MAX.text
      )},${textColumn(
        'p',
        'content',
        MAX.text
      )},lower(btrim(p."profileId"::text)) AS "profileId",lower(btrim(p."userId"::text)) AS "userId",${textColumn(
        'p',
        'appScope'
      )},p."createdAt"::text AS "createdAt",p."updatedAt"::text AS "updatedAt",${textColumn(
        'p',
        'visibility'
      )},p."publicAudienceExplicit",p."scheduledAt"::text AS "scheduledAt",p."isScheduled",left(p."communityId"::text,513) AS "communityId" FROM "post" p ${owned(
        'p'
      )} WHERE lower(btrim(p."userId"::text))=$1 AND ($2::text IS NULL OR p."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY p."id"::text COLLATE "C" LIMIT $3`,
      project: (row, accountId) => ({
        ...projection(
          'Post',
          [
            'title',
            'content',
            'profileId',
            'userId',
            'appScope',
            'createdAt',
            'updatedAt',
            'visibility',
            'publicAudienceExplicit',
            'scheduledAt',
            'isScheduled',
          ],
          {
            legacy: true,
            timestamps: ['createdAt', 'updatedAt'],
            nullableTimestamps: ['scheduledAt'],
          }
        )(row, accountId),
        communityId:
          row.communityId == null ? null : requiredId(String(row.communityId)),
      }),
    },
    {
      source: 'Comment',
      sql: `SELECT s."id"::text AS "id",${textColumn(
        's',
        'content',
        MAX.text
      )},lower(btrim(s."userId"::text)) AS "userId",lower(btrim(s."profileId"::text)) AS "profileId",${textColumn(
        's',
        'appScope'
      )},s."createdAt"::text AS "createdAt",s."updatedAt"::text AS "updatedAt",left(s."postId"::text,513) AS "postId",left(s."parentId"::text,513) AS "parentId" FROM "comment" s ${owned(
        's'
      )} WHERE lower(btrim(s."userId"::text))=$1 AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: projection(
        'Comment',
        [
          'content',
          'userId',
          'profileId',
          'appScope',
          'createdAt',
          'updatedAt',
          'postId',
          'parentId',
        ],
        {
          legacy: true,
          timestamps: ['createdAt', 'updatedAt'],
          references: ['postId', 'parentId'],
          requiredReferences: ['postId'],
        }
      ),
    },
    {
      source: 'Reaction',
      sql: `SELECT s."id"::text AS "id",s."value",lower(btrim(s."userId"::text)) AS "userId",lower(btrim(s."profileId"::text)) AS "profileId",${textColumn(
        's',
        'appScope'
      )},s."createdAt"::text AS "createdAt",left(s."postId"::text,513) AS "postId",left(s."commentId"::text,513) AS "commentId" FROM "reaction" s ${owned(
        's'
      )} WHERE lower(btrim(s."userId"::text))=$1 AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: projection(
        'Reaction',
        [
          'value',
          'userId',
          'profileId',
          'appScope',
          'createdAt',
          'postId',
          'commentId',
        ],
        {
          legacy: true,
          timestamps: ['createdAt'],
          references: ['postId', 'commentId'],
        }
      ),
    },
    {
      source: 'Vote',
      sql: `SELECT s."id"::text AS "id",s."value",lower(btrim(s."userId"::text)) AS "userId",lower(btrim(s."profileId"::text)) AS "profileId",${textColumn(
        's',
        'appScope'
      )},left(s."postId"::text,513) AS "postId",left(s."commentId"::text,513) AS "commentId" FROM "vote" s ${owned(
        's'
      )} WHERE lower(btrim(s."userId"::text))=$1 AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: projection(
        'Vote',
        ['value', 'userId', 'profileId', 'appScope', 'postId', 'commentId'],
        {
          legacy: true,
          references: ['postId', 'commentId'],
          numericId: true,
        }
      ),
    },
    {
      source: 'Attachment',
      sql: `SELECT s."id"::text AS "id",${textColumn('s', 'name')},${textColumn(
        's',
        'type',
        64
      )},${textColumn(
        's',
        'appScope'
      )},left(s."postId"::text,513) AS "postId",CASE WHEN s."filePath" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN lower(s."filePath") WHEN s."filePath" ~* '^/(api/)?asset/[0-9a-f-]{36}$' THEN lower(regexp_replace(s."filePath", '^.*/', '')) WHEN s."filePath" ~* '^https?://[^/?#@]+/(api/)?asset/[0-9a-f-]{36}$' THEN lower(regexp_replace(s."filePath", '^.*/', '')) ELSE NULL END AS "mediaAssetId" FROM "attachment" s WHERE ${postOwned} s."postId") AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: (row) => {
        const uuid =
          row.mediaAssetId == null ? null : entityId(row.mediaAssetId);
        return {
          id: entityId(row.id),
          name: checkedText(row, 'name'),
          type: checkedText(row, 'type', 64),
          appScope: checkedText(row, 'appScope'),
          postId: entityId(row.postId),
          mediaReference: uuid
            ? {
                kind: 'asset-reference',
                id: uuid,
                binding: 'referenceOnly-unverified',
              }
            : null,
          mediaReferenceDisposition: uuid
            ? 'referenceOnly-unverified'
            : 'excluded-unverified',
          attribution: 'recorded-unverified',
          consent: 'not-inferred',
        };
      },
    },
    {
      source: 'Poll',
      sql: `SELECT s."id"::text AS "id",${textColumn(
        's',
        'question',
        MAX.text
      )},left(s."options",65537) AS "options",char_length(s."options") AS "optionsLength",s."isMultipleChoice",s."endsAt"::text AS "endsAt",s."showResultsBeforeVote",s."isAnonymous",lower(btrim(s."profileId"::text)) AS "profileId",lower(btrim(s."userId"::text)) AS "userId",s."isActive",s."createdAt"::text AS "createdAt" FROM "poll" s ${owned(
        's'
      )} WHERE lower(btrim(s."userId"::text))=$1 AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: (row, accountId) => {
        const base = projection(
          'Poll',
          [
            'question',
            'isMultipleChoice',
            'endsAt',
            'showResultsBeforeVote',
            'isAnonymous',
            'profileId',
            'userId',
            'isActive',
            'createdAt',
          ],
          {
            legacy: true,
            timestamps: ['createdAt'],
            nullableTimestamps: ['endsAt'],
          }
        )(row, accountId);
        const options =
          typeof row.options === 'string'
            ? row.options.split(',')
            : row.options;
        if (
          !Array.isArray(options) ||
          options.length > MAX.items ||
          Number(row.optionsLength) > MAX.text
        )
          return fail();
        return {
          ...base,
          options: options.map((x) => boundedString(x, MAX.item)),
        };
      },
    },
    {
      source: 'SocialComponent',
      sql: `SELECT s."id"::text AS "id",left(s."postId"::text,513) AS "postId",${textColumn(
        's',
        'instanceId'
      )},${textColumn(
        's',
        'componentType'
      )},s."position",s."createdAt"::text AS "createdAt",s."updatedAt"::text AS "updatedAt" FROM "social_components" s WHERE ${postOwned} s."postId") AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: projection(
        'SocialComponent',
        [
          'postId',
          'instanceId',
          'componentType',
          'position',
          'createdAt',
          'updatedAt',
        ],
        {
          legacy: true,
          timestamps: ['createdAt', 'updatedAt'],
          references: ['postId'],
          requiredReferences: ['postId'],
        }
      ),
    },
    {
      source: 'Link',
      sql: `SELECT (pl."postId"::text || ':' || l."id"::text) AS "id",pl."postId"::text AS "postId",l."id"::text AS "linkId",${textColumn(
        'l',
        'url'
      )},${textColumn(
        'l',
        'appScope'
      )} FROM "post_link" pl JOIN "link" l ON l."id"=pl."linkId" WHERE ${postOwned} pl."postId") AND ($2::text IS NULL OR (pl."postId"::text || ':' || l."id"::text) COLLATE "C">$2 COLLATE "C") ORDER BY (pl."postId"::text || ':' || l."id"::text) COLLATE "C" LIMIT $3`,
      project: (row) => {
        const raw = checkedText(row, 'url');
        const asset = assetReference(raw);
        return {
          id: requiredId(row.id),
          postId: entityId(row.postId),
          linkId: requiredId(String(row.linkId)),
          url: asset
            ? {
                kind: 'asset-reference',
                id: asset,
                binding: 'referenceOnly-unverified',
              }
            : safeUrl(raw),
          appScope: checkedText(row, 'appScope'),
          attribution: 'recorded-unverified',
          consent: 'not-inferred',
        };
      },
    },
    {
      source: 'PostShare',
      sql: `SELECT s."id"::text AS "id",left(s."originalPostId"::text,513) AS "originalPostId",lower(btrim(s."sharedById"::text)) AS "sharedById",${textColumn(
        's',
        'comment',
        MAX.text
      )},${textColumn(
        's',
        'visibility'
      )},left(s."communityId"::text,513) AS "communityId",s."createdAt"::text AS "createdAt" FROM "post_share" s JOIN "${profileTable}" owned ON owned."id"::text=lower(btrim(s."sharedById"::text)) WHERE $1::uuid IS NOT NULL AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: projection(
        'PostShare',
        [
          'originalPostId',
          'sharedById',
          'comment',
          'visibility',
          'communityId',
          'createdAt',
        ],
        {
          legacy: true,
          timestamps: ['createdAt'],
          references: ['originalPostId', 'communityId'],
          requiredReferences: ['originalPostId'],
          nullableStrings: ['comment'],
        }
      ),
    },
    {
      source: 'Event',
      sql: `SELECT s."id"::text AS "id",${textColumn(
        's',
        'title',
        MAX.text
      )},${textColumn(
        's',
        'description',
        MAX.text
      )},s."startDate"::text AS "startDate",s."endDate"::text AS "endDate",${textColumn(
        's',
        'location'
      )},${textColumn('s', 'locationUrl')},${textColumn(
        's',
        'privacy'
      )},left(s."communityId"::text,513) AS "communityId",lower(btrim(s."profileId"::text)) AS "profileId",lower(btrim(s."userId"::text)) AS "userId",${textColumn(
        's',
        'status'
      )},CASE WHEN s."coverImageUrl" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN lower(s."coverImageUrl") WHEN s."coverImageUrl" ~* '^/(api/)?asset/[0-9a-f-]{36}$' THEN lower(regexp_replace(s."coverImageUrl", '^.*/', '')) WHEN s."coverImageUrl" ~* '^https?://[^/?#@]+/(api/)?asset/[0-9a-f-]{36}$' THEN lower(regexp_replace(s."coverImageUrl", '^.*/', '')) ELSE NULL END AS "coverImageReference",s."createdAt"::text AS "createdAt",s."updatedAt"::text AS "updatedAt" FROM "event" s ${owned(
        's'
      )} WHERE lower(btrim(s."userId"::text))=$1 AND ($2::text IS NULL OR s."id"::text COLLATE "C">$2 COLLATE "C") ORDER BY s."id"::text COLLATE "C" LIMIT $3`,
      project: (row, accountId) => {
        const p = projection(
          'Event',
          [
            'title',
            'description',
            'startDate',
            'endDate',
            'location',
            'locationUrl',
            'privacy',
            'communityId',
            'profileId',
            'userId',
            'status',
            'createdAt',
            'updatedAt',
          ],
          {
            legacy: true,
            timestamps: ['startDate', 'createdAt', 'updatedAt'],
            nullableTimestamps: ['endDate'],
            references: ['communityId'],
            urls: ['locationUrl'],
            nullableUrls: ['locationUrl'],
            nullableStrings: ['description', 'location'],
          }
        );
        const result = p(row, accountId);
        const coverId =
          row.coverImageReference == null
            ? null
            : entityId(row.coverImageReference);
        result.coverImageReference = coverId
          ? {
              kind: 'asset-reference',
              id: coverId,
              binding: 'referenceOnly-unverified',
            }
          : null;
        result.coverImageReferenceDisposition = coverId
          ? 'referenceOnly-unverified'
          : 'excluded-unverified';
        return result;
      },
    },
  ];
  return sources;
}

export const SOCIAL_AUTHORED_LEGACY_ATTRIBUTION = RECORDED;
