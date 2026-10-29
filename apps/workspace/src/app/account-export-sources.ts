import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';
import {
  WORKSPACE_KINDS,
  WORKSPACE_STATUSES,
  WorkspaceSourceService,
} from '@optimistic-tanuki/models';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORDED = {
  attribution: 'recorded-unverified',
  consent: 'not-inferred',
};
const timestamp = (value: unknown): string => {
  const raw = value instanceof Date ? value.toISOString() : value;
  if (
    typeof raw !== 'string' ||
    !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:?\d\d)?$/.test(
      raw
    )
  )
    throw new Error('WORKSPACE_EXPORT_INVALID_TIMESTAMP');
  const date = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error('WORKSPACE_EXPORT_INVALID_TIMESTAMP');
  const fractional = raw.match(/\.(\d{1,6})(?:Z|[+-]\d\d:?\d\d)?$/)?.[1] ?? '';
  const utc = date.toISOString();
  return fractional.length > 3
    ? utc.replace(/Z$/, `${fractional.slice(3)}Z`)
    : utc;
};
const id = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new Error('WORKSPACE_EXPORT_INVALID_ID');
  return value.toLowerCase();
};
const bounded = (value: unknown, max: number, required = false): string => {
  if (
    typeof value !== 'string' ||
    Array.from(value).length > max ||
    (required && !value.trim())
  )
    throw new Error('WORKSPACE_EXPORT_INVALID_TEXT');
  return value;
};
const enumValue = <T extends string>(
  value: unknown,
  values: readonly T[]
): T => {
  if (
    typeof value !== 'string' ||
    !(values as readonly string[]).includes(value)
  )
    throw new Error('WORKSPACE_EXPORT_UNKNOWN_ENUM');
  return value as T;
};

export function createWorkspaceAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('WORKSPACE_EXPORT_INVALID_PROFILE_TABLE');
  const cols = [
    'id',
    'kind',
    'slug',
    'displayName',
    'appScope',
    'ownerUserId',
    'ownerProfileId',
    'status',
    'sourceService',
    'sourceId',
    'createdAt',
    'updatedAt',
  ];
  const projection = cols
    .map(
      (name) =>
        `left(r."${name}"::text,${
          name === 'slug' || name === 'displayName'
            ? 256
            : name === 'appScope'
            ? 129
            : 65
        }) AS "${name}"`
    )
    .join(',');
  const source: AccountExportPostgresSource = {
    source: 'Workspace',
    sql: `SELECT ${projection} FROM "workspaces" r WHERE lower(r."ownerUserId"::text)=$1 AND lower(r."ownerProfileId"::text) IN (SELECT lower(identities.id::text) FROM "${profileTable}" identities) AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C") ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(row, accountId) {
      const normalizedAccount = id(accountId);
      const ownerUserId = id(row.ownerUserId);
      if (ownerUserId !== normalizedAccount)
        throw new Error('WORKSPACE_EXPORT_IDENTITY_MISMATCH');
      return {
        id: id(row.id),
        kind: enumValue(row.kind, WORKSPACE_KINDS),
        slug: bounded(row.slug, 255),
        displayName: bounded(row.displayName, 255),
        appScope: bounded(row.appScope, 128, true),
        ownerUserId,
        ownerProfileId: id(row.ownerProfileId),
        status: enumValue(row.status, WORKSPACE_STATUSES),
        sourceService: enumValue(row.sourceService, [
          'store',
          'social',
          'app-configurator',
        ] as const satisfies readonly WorkspaceSourceService[]),
        sourceId: id(row.sourceId),
        createdAt: timestamp(row.createdAt),
        updatedAt: timestamp(row.updatedAt),
        ...RECORDED,
      };
    },
  };
  if (source.source !== WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES[0])
    throw new Error('WORKSPACE_EXPORT_SOURCE_REGISTRY_MISMATCH');
  return [source];
}
