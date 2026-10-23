import { CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (v: unknown): string => {
  if (
    typeof v !== 'string' ||
    !UUID.test(v) ||
    /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(v)
  )
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_ID');
  return v.toLowerCase();
};
const text = (v: unknown, max: number, required = false): string => {
  if (
    typeof v !== 'string' ||
    Array.from(v).length > max ||
    (required && !v.trim())
  )
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_TEXT');
  return v;
};
const decimal = (v: unknown): string => {
  if (typeof v !== 'string' || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_PRICE');
  const [whole, fraction = ''] = v.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
};
const timestamp = (v: unknown): string => {
  const raw = v instanceof Date ? v.toISOString() : v;
  if (
    typeof raw !== 'string' ||
    !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)?$/.test(
      raw
    )
  )
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_TIMESTAMP');
  const normalized = raw.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
  const date = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_TIMESTAMP');
  const fraction =
    normalized.match(/\.(\d{1,6})(?:Z|[+-]\d\d:?\d\d)?$/)?.[1] ?? '';
  return date
    .toISOString()
    .replace(/Z$/, `${fraction.length > 3 ? fraction.slice(3) : ''}Z`);
};
const oneOf = (v: unknown, values: string[]): string => {
  if (typeof v !== 'string' || !values.includes(v))
    throw new Error('CLASSIFIEDS_EXPORT_UNKNOWN_ENUM');
  return v;
};

export function createClassifiedsAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('CLASSIFIEDS_EXPORT_INVALID_PROFILE_TABLE');
  const source: AccountExportPostgresSource = {
    source: 'ClassifiedAdEntity',
    // Candidates are account scoped first. The binding proof is projected per row so a foreign binding fails capture.
    sql: `SELECT r.id::text AS id,left(r.title::text,256) AS title,left(r.description::text,65537) AS description,r.price::text AS price,left(r.currency::text,11) AS currency,CASE WHEN r.category IS NULL THEN NULL ELSE left(r.category::text,101) END AS category,CASE WHEN r.condition IS NULL THEN NULL ELSE left(r.condition::text,51) END AS condition,left(r.status::text,51) AS status,r."communityId"::text AS "communityId",r."profileId"::text AS "profileId",r."userId"::text AS "userId",left(r."appScope"::text,101) AS "appScope",r."isFeatured" AS "isFeatured",r."featuredUntil"::text AS "featuredUntil",r."createdAt"::text AS "createdAt",r."updatedAt"::text AS "updatedAt",r."expiresAt"::text AS "expiresAt",EXISTS(SELECT 1 FROM "${profileTable}" identities WHERE identities.id=r."profileId") AS "profileBindingValid" FROM classified_ad r WHERE r."userId"=$1::uuid AND r."appScope" IN ('client-interface','local-hub') AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C") ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(row, account) {
      const accountId = id(account);
      if (id(row['userId']) !== accountId)
        throw new Error('CLASSIFIEDS_EXPORT_IDENTITY_MISMATCH');
      if (row['profileBindingValid'] !== true)
        throw new Error('CLASSIFIEDS_EXPORT_PROFILE_BINDING_UNVERIFIED');
      if (row['isFeatured'] !== true && row['isFeatured'] !== false)
        throw new Error('CLASSIFIEDS_EXPORT_INVALID_BOOLEAN');
      const optionalId =
        row['communityId'] == null ? null : text(row['communityId'], 36);
      if (optionalId !== null && !UUID.test(optionalId))
        throw new Error('CLASSIFIEDS_EXPORT_INVALID_REFERENCE');
      return {
        id: id(row['id']),
        title: text(row['title'], 255, true),
        description: text(row['description'], 65536),
        price: decimal(row['price']),
        currency: text(row['currency'], 10, true),
        category: row['category'] == null ? null : text(row['category'], 100),
        condition: row['condition'] == null ? null : text(row['condition'], 50),
        status: oneOf(row['status'], ['active', 'sold', 'expired', 'removed']),
        communityId: optionalId,
        profileId: id(row['profileId']),
        userId: accountId,
        appScope: oneOf(row['appScope'], ['client-interface', 'local-hub']),
        isFeatured: row['isFeatured'],
        featuredUntil:
          row['featuredUntil'] == null ? null : timestamp(row['featuredUntil']),
        createdAt: timestamp(row['createdAt']),
        updatedAt: timestamp(row['updatedAt']),
        expiresAt:
          row['expiresAt'] == null ? null : timestamp(row['expiresAt']),
        mediaDisposition: 'excluded-unverified-image-references',
        attribution: 'recorded-unverified',
        consent: 'not-inferred',
      };
    },
  };
  if (source.source !== CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES[0])
    throw new Error('CLASSIFIEDS_EXPORT_SOURCE_REGISTRY_MISMATCH');
  return [source];
}
