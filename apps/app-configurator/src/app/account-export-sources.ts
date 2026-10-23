import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';
import { APP_ACCESS_POLICIES } from '@optimistic-tanuki/app-config-models';
import {
  WORKSPACE_APP_LIFECYCLE_STATES,
  WORKSPACE_APP_MEMBERSHIP_ROLES,
} from '@optimistic-tanuki/models';
import { APP_MEMBERSHIP_STATUSES } from '../configurations/entities/app-membership.entity';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recorded = {
  attribution: 'recorded-unverified',
  consent: 'not-inferred',
};
const id = (v: unknown): string => {
  if (typeof v !== 'string' || !UUID.test(v))
    throw new Error('APP_CONFIG_EXPORT_INVALID_ID');
  return v.toLowerCase();
};
const text = (v: unknown, max: number, required = false): string => {
  if (
    typeof v !== 'string' ||
    Array.from(v).length > max ||
    (required && !v.trim())
  )
    throw new Error('APP_CONFIG_EXPORT_INVALID_TEXT');
  return v;
};
const timestamp = (v: unknown): string => {
  const raw = v instanceof Date ? v.toISOString() : v;
  if (
    typeof raw !== 'string' ||
    !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:?\d\d)?$/.test(
      raw
    )
  )
    throw new Error('APP_CONFIG_EXPORT_INVALID_TIMESTAMP');
  const date = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error('APP_CONFIG_EXPORT_INVALID_TIMESTAMP');
  const fraction = raw.match(/\.(\d{1,6})(?:Z|[+-]\d\d:?\d\d)?$/)?.[1] ?? '';
  return date
    .toISOString()
    .replace(/Z$/, `${fraction.length > 3 ? fraction.slice(3) : ''}Z`);
};
const enumValue = <T extends string>(v: unknown, values: readonly T[]): T => {
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v))
    throw new Error('APP_CONFIG_EXPORT_UNKNOWN_ENUM');
  return v as T;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== 'boolean')
    throw new Error('APP_CONFIG_EXPORT_INVALID_BOOLEAN');
  return v;
};
const projection = (cols: string[]) =>
  cols
    .map((c) =>
      c === 'active'
        ? `r."${c}"`
        : `left(r."${c}"::text,${
            c === 'name'
              ? 256
              : c === 'domain'
              ? 255
              : c === 'appScope'
              ? 129
              : c === 'createdAt' || c === 'updatedAt'
              ? 40
              : c === 'status' || c === 'role' || c === 'accessPolicy'
              ? 64
              : 65
          }) AS "${c}"`
    )
    .join(',');
const where = (user: string, profile: string, profileTable: string) =>
  `lower(r."${user}"::text)=$1 AND lower(r."${profile}"::text) IN (SELECT lower(identities.id::text) FROM "${profileTable}" identities) AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C")`;

export function createAppConfiguratorAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('APP_CONFIG_EXPORT_INVALID_PROFILE_TABLE');
  const common = (
    source: string,
    table: string,
    fields: string[],
    user: string,
    profile: string,
    project: (
      row: Record<string, unknown>,
      account: string
    ) => Record<string, unknown>,
    parent = ''
  ): AccountExportPostgresSource => ({
    source,
    sql: `SELECT ${projection(fields)}${parent} FROM "${table}" r WHERE ${where(
      user,
      profile,
      profileTable
    )} ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(row, account) {
      return project(row, account);
    },
  });
  const instance = common(
    'AppInstanceEntity',
    'app_instances',
    [
      'id',
      'workspaceId',
      'appScope',
      'ownerUserId',
      'ownerProfileId',
      'status',
      'createdAt',
      'updatedAt',
    ],
    'ownerUserId',
    'ownerProfileId',
    (r, a) => {
      const ownerUserId = id(r.ownerUserId);
      if (ownerUserId !== id(a))
        throw new Error('APP_CONFIG_EXPORT_IDENTITY_MISMATCH');
      return {
        id: id(r.id),
        workspaceId: id(r.workspaceId),
        appScope: text(r.appScope, 128, true),
        ownerUserId,
        ownerProfileId: id(r.ownerProfileId),
        status: enumValue(r.status, WORKSPACE_APP_LIFECYCLE_STATES),
        createdAt: timestamp(r.createdAt),
        updatedAt: timestamp(r.updatedAt),
        ...recorded,
      };
    }
  );
  const configuration: AccountExportPostgresSource = {
    source: 'AppConfigurationEntity',
    sql: `SELECT ${projection([
      'id',
      'name',
      'workspaceId',
      'appInstanceId',
      'ownerUserId',
      'ownerProfileId',
      'appScope',
      'domain',
      'active',
      'accessPolicy',
      'revision',
      'createdAt',
      'updatedAt',
    ])}, EXISTS (SELECT 1 FROM app_instances p WHERE p.id=r."appInstanceId" AND p."workspaceId"=r."workspaceId" AND p."appScope"=r."appScope" AND lower(p."ownerUserId"::text)=lower(r."ownerUserId"::text) AND lower(p."ownerProfileId"::text)=lower(r."ownerProfileId"::text)) AS "parentValid" FROM "app_configuration_entity" r WHERE ${where(
      'ownerUserId',
      'ownerProfileId',
      profileTable
    )} ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(r, a) {
      if (r.parentValid !== true && r.parentValid !== 't')
        throw new Error('APP_CONFIG_EXPORT_INVALID_PARENT');
      const ownerUserId = id(r.ownerUserId);
      if (ownerUserId !== id(a))
        throw new Error('APP_CONFIG_EXPORT_IDENTITY_MISMATCH');
      if (
        r.domain !== null &&
        r.domain !== undefined &&
        (typeof r.domain !== 'string' ||
          Array.from(r.domain).length > 254 ||
          !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
            r.domain
          ))
      )
        throw new Error('APP_CONFIG_EXPORT_INVALID_DOMAIN');
      if (typeof r.revision !== 'number' && typeof r.revision !== 'string')
        throw new Error('APP_CONFIG_EXPORT_INVALID_REVISION');
      const rev = Number(r.revision);
      if (!Number.isSafeInteger(rev) || rev < 1)
        throw new Error('APP_CONFIG_EXPORT_INVALID_REVISION');
      return {
        id: id(r.id),
        name: text(r.name, 255, true),
        workspaceId: id(r.workspaceId),
        appInstanceId: id(r.appInstanceId),
        ownerUserId,
        ownerProfileId: id(r.ownerProfileId),
        appScope: text(r.appScope, 128, true),
        domain: r.domain == null ? null : text(r.domain, 254),
        active: bool(r.active),
        accessPolicy: enumValue(r.accessPolicy, APP_ACCESS_POLICIES),
        revision: rev,
        createdAt: timestamp(r.createdAt),
        updatedAt: r.updatedAt == null ? null : timestamp(r.updatedAt),
        ...recorded,
      };
    },
  };
  const membership = common(
    'AppMembershipEntity',
    'app_memberships',
    [
      'id',
      'workspaceId',
      'appInstanceId',
      'appScope',
      'userId',
      'profileId',
      'role',
      'status',
      'createdAt',
      'updatedAt',
    ],
    'userId',
    'profileId',
    (r, a) => {
      const userId = id(r.userId);
      if (userId !== id(a))
        throw new Error('APP_CONFIG_EXPORT_IDENTITY_MISMATCH');
      if (r.parentValid !== true && r.parentValid !== 't')
        throw new Error('APP_CONFIG_EXPORT_INVALID_PARENT');
      return {
        id: id(r.id),
        workspaceId: id(r.workspaceId),
        appInstanceId: id(r.appInstanceId),
        appScope: text(r.appScope, 128, true),
        userId,
        profileId: id(r.profileId),
        role: enumValue(r.role, WORKSPACE_APP_MEMBERSHIP_ROLES),
        status: enumValue(r.status, APP_MEMBERSHIP_STATUSES),
        createdAt: timestamp(r.createdAt),
        updatedAt: timestamp(r.updatedAt),
        ...recorded,
      };
    },
    ', EXISTS (SELECT 1 FROM app_instances p WHERE p.id=r."appInstanceId" AND p."workspaceId"=r."workspaceId" AND p."appScope"=r."appScope") AS "parentValid"'
  );
  const sources = [configuration, instance, membership];
  if (
    sources.map((s) => s.source).join('|') !==
    APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES.join('|')
  )
    throw new Error('APP_CONFIG_EXPORT_SOURCE_REGISTRY_MISMATCH');
  return sources;
}
