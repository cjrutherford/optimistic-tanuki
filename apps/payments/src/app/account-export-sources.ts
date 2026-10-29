import { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recorded = {
  attribution: 'recorded-unverified',
  consent: 'not-inferred',
};
const id = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !UUID.test(value) ||
    /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)
  )
    throw new Error('PAYMENTS_EXPORT_INVALID_ID');
  return value.toLowerCase();
};
const text = (value: unknown, max: number, required = false): string => {
  if (
    typeof value !== 'string' ||
    Array.from(value).length > max ||
    (required && !value.trim())
  )
    throw new Error('PAYMENTS_EXPORT_INVALID_TEXT');
  return value;
};
// PostgreSQL numeric values are selected as text so decimal precision is never lost through JS numbers.
const decimal = (value: unknown): string => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,7})\.\d{2}$/.test(value))
    throw new Error('PAYMENTS_EXPORT_INVALID_DECIMAL');
  return value;
};
const timestamp = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)?$/.test(
      value
    )
  )
    throw new Error('PAYMENTS_EXPORT_INVALID_TIMESTAMP');
  const raw = value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (!Number.isFinite(date.getTime()))
    throw new Error('PAYMENTS_EXPORT_INVALID_TIMESTAMP');
  const fraction = raw.match(/\.(\d{1,6})(?:Z|[+-]\d\d:?\d\d)?$/)?.[1] ?? '';
  return date
    .toISOString()
    .replace(/Z$/, `${fraction.length > 3 ? fraction.slice(3) : ''}Z`);
};
const enumValue = (value: unknown, allowed: readonly string[]): string => {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw new Error('PAYMENTS_EXPORT_UNKNOWN_ENUM');
  return value;
};
const identity = (
  row: Record<string, unknown>,
  account: string,
  ...fields: string[]
): string[] => {
  const accountId = id(account);
  const matches = fields.filter(
    (field) => row[field] != null && id(row[field]) === accountId
  );
  if (
    !matches.length ||
    fields.some(
      (field) =>
        row[field] != null &&
        id(row[field]) !== accountId &&
        fields.length === 1
    )
  )
    throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
  return matches;
};
const projection = (table: string, columns: string[], predicate: string) =>
  `SELECT ${columns
    .map(
      (column) =>
        `r."${column}"${
          [
            'amount',
            'platformFeeAmount',
            'sellerReceivesAmount',
            'offeredAmount',
            'availableBalance',
            'pendingBalance',
            'totalEarned',
            'totalPaidOut',
            'platformFee',
            'netAmount',
          ].includes(column) ||
          [
            'createdAt',
            'updatedAt',
            'cancelledAt',
            'lastPayoutAt',
            'confirmedAt',
            'releasedAt',
            'expiresAt',
            'processedAt',
            'subscriptionExpiresAt',
            'startsAt',
          ].includes(column)
            ? '::text'
            : ''
        } AS "${column}"`
    )
    .join(
      ','
    )} FROM "${table}" r WHERE ${predicate} AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C") ORDER BY r.id::text COLLATE "C" LIMIT $3`;

export function createPaymentsAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('PAYMENTS_EXPORT_INVALID_PROFILE_TABLE');
  const source = (
    name: string,
    table: string,
    columns: string[],
    predicate: string,
    project: AccountExportPostgresSource['project']
  ): AccountExportPostgresSource => ({
    source: name,
    sql: projection(table, columns, predicate),
    project,
  });
  const sources: AccountExportPostgresSource[] = [
    source(
      'Donation',
      'donations',
      [
        'id',
        'userId',
        'profileId',
        'amount',
        'isRecurring',
        'status',
        'currency',
        'createdAt',
        'cancelledAt',
      ],
      'r."userId"=$1::uuid',
      (r, a) => {
        if (id(r.userId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        if (
          r.profileId != null &&
          r.profileBindingValid !== true &&
          r.profileBindingValid !== 't'
        )
          throw new Error('PAYMENTS_EXPORT_PROFILE_BINDING_UNVERIFIED');
        if (typeof r.isRecurring !== 'boolean')
          throw new Error('PAYMENTS_EXPORT_INVALID_BOOLEAN');
        return {
          id: id(r.id),
          userId: id(a),
          profileId: r.profileId == null ? null : id(r.profileId),
          amount: decimal(r.amount),
          isRecurring: r.isRecurring,
          status: enumValue(r.status, [
            'pending',
            'completed',
            'failed',
            'cancelled',
          ]),
          currency: r.currency == null ? null : text(r.currency, 3, true),
          createdAt: timestamp(r.createdAt),
          cancelledAt: r.cancelledAt == null ? null : timestamp(r.cancelledAt),
          ...recorded,
        };
      }
    ),
    source(
      'ClassifiedPayment',
      'classified_payments',
      [
        'id',
        'classifiedId',
        'buyerId',
        'sellerId',
        'amount',
        'offerId',
        'status',
        'createdAt',
        'confirmedAt',
        'releasedAt',
      ],
      '(r."buyerId"=$1::uuid OR r."sellerId"=$1::uuid)',
      (r, a) => {
        const roles = identity(r, a, 'buyerId', 'sellerId');
        return {
          id: id(r.id),
          relationship: roles.map((key) =>
            key === 'buyerId' ? 'buyer' : 'seller'
          ),
          classifiedReference: id(r.classifiedId),
          offerReference: r.offerId == null ? null : id(r.offerId),
          amount: decimal(r.amount),
          status: enumValue(r.status, [
            'pending',
            'confirmed',
            'released',
            'disputed',
            'cancelled',
            'refunded',
          ]),
          createdAt: timestamp(r.createdAt),
          confirmedAt: r.confirmedAt == null ? null : timestamp(r.confirmedAt),
          releasedAt: r.releasedAt == null ? null : timestamp(r.releasedAt),
          ...recorded,
        };
      }
    ),
    source(
      'SellerWallet',
      'seller_wallets',
      [
        'id',
        'sellerId',
        'availableBalance',
        'pendingBalance',
        'totalEarned',
        'totalPaidOut',
        'createdAt',
        'lastPayoutAt',
      ],
      'r."sellerId"=$1::uuid',
      (r, a) => {
        if (id(r.sellerId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        return {
          id: id(r.id),
          sellerId: id(a),
          availableBalance: decimal(r.availableBalance),
          pendingBalance: decimal(r.pendingBalance),
          totalEarned: decimal(r.totalEarned),
          totalPaidOut: decimal(r.totalPaidOut),
          createdAt: timestamp(r.createdAt),
          lastPayoutAt:
            r.lastPayoutAt == null ? null : timestamp(r.lastPayoutAt),
          ...recorded,
        };
      }
    ),
    source(
      'Transaction',
      'payment_events',
      [
        'id',
        'userId',
        'type',
        'direction',
        'amount',
        'platformFee',
        'netAmount',
        'currency',
        'referenceId',
        'status',
        'createdAt',
      ],
      'r."userId"=$1::uuid',
      (r, a) => {
        if (id(r.userId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        return {
          id: id(r.id),
          userId: id(a),
          type: enumValue(r.type, [
            'donation',
            'classified_payment',
            'business_subscription',
            'sponsorship',
            'refund',
            'payout',
          ]),
          direction: enumValue(r.direction, ['incoming', 'outgoing']),
          amount: decimal(r.amount),
          platformFee: decimal(r.platformFee),
          netAmount: decimal(r.netAmount),
          currency: r.currency == null ? null : text(r.currency, 3, true),
          reference: r.referenceId == null ? null : id(r.referenceId),
          status: enumValue(r.status, [
            'pending',
            'completed',
            'failed',
            'refunded',
          ]),
          createdAt: timestamp(r.createdAt),
          ...recorded,
        };
      }
    ),
    source(
      'Offer',
      'offers',
      [
        'id',
        'classifiedId',
        'buyerId',
        'sellerId',
        'offeredAmount',
        'status',
        'expiresAt',
        'acceptedPaymentId',
        'createdAt',
        'updatedAt',
      ],
      '(r."buyerId"=$1::uuid OR r."sellerId"=$1::uuid)',
      (r, a) => {
        const roles = identity(r, a, 'buyerId', 'sellerId');
        return {
          id: id(r.id),
          relationship: roles.map((key) =>
            key === 'buyerId' ? 'buyer' : 'seller'
          ),
          classifiedReference: id(r.classifiedId),
          amount: decimal(r.offeredAmount),
          status: enumValue(r.status, [
            'pending',
            'accepted',
            'rejected',
            'countered',
            'withdrawn',
            'expired',
          ]),
          expiresAt: timestamp(r.expiresAt),
          acceptedPaymentReference:
            r.acceptedPaymentId == null ? null : id(r.acceptedPaymentId),
          createdAt: timestamp(r.createdAt),
          updatedAt: timestamp(r.updatedAt),
          ...recorded,
        };
      }
    ),
    source(
      'PayoutRequest',
      'payout_requests',
      ['id', 'sellerId', 'amount', 'status', 'createdAt', 'processedAt'],
      'r."sellerId"=$1::uuid',
      (r, a) => {
        if (id(r.sellerId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        return {
          id: id(r.id),
          sellerId: id(a),
          amount: decimal(r.amount),
          status: enumValue(r.status, [
            'pending',
            'processing',
            'completed',
            'rejected',
            'cancelled',
          ]),
          createdAt: timestamp(r.createdAt),
          processedAt: r.processedAt == null ? null : timestamp(r.processedAt),
          ...recorded,
        };
      }
    ),
    source(
      'BusinessPage',
      'business_pages',
      [
        'id',
        'communityId',
        'ownerId',
        'name',
        'tier',
        'subscriptionStatus',
        'createdAt',
        'updatedAt',
        'subscriptionExpiresAt',
      ],
      'r."ownerId"=$1::uuid',
      (r, a) => {
        if (id(r.ownerId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        return {
          id: id(r.id),
          communityReference: id(r.communityId),
          ownerId: id(a),
          name: r.name == null ? null : text(r.name, 255),
          tier: enumValue(r.tier, ['basic', 'pro', 'enterprise']),
          subscriptionStatus: enumValue(r.subscriptionStatus, [
            'active',
            'inactive',
            'cancelled',
            'past_due',
          ]),
          createdAt: timestamp(r.createdAt),
          updatedAt: timestamp(r.updatedAt),
          subscriptionExpiresAt:
            r.subscriptionExpiresAt == null
              ? null
              : timestamp(r.subscriptionExpiresAt),
          ...recorded,
        };
      }
    ),
    source(
      'BusinessTheme',
      'business_themes',
      ['id', 'businessPageId', 'createdAt', 'updatedAt'],
      `EXISTS (SELECT 1 FROM business_pages p WHERE p.id=r."businessPageId" AND p."ownerId"=$1::uuid)`,
      (r, a) => {
        if (r.subjectBindingValid !== true && r.subjectBindingValid !== 't')
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        return {
          id: id(r.id),
          businessPageReference: id(r.businessPageId),
          createdAt: timestamp(r.createdAt),
          updatedAt: timestamp(r.updatedAt),
          ...recorded,
        };
      }
    ),
    source(
      'CommunitySponsorship',
      'community_sponsorships',
      [
        'id',
        'communityId',
        'businessPageId',
        'userId',
        'type',
        'amount',
        'status',
        'createdAt',
        'startsAt',
        'expiresAt',
        'months',
      ],
      'r."userId"=$1::uuid',
      (r, a) => {
        if (id(r.userId) !== id(a))
          throw new Error('PAYMENTS_EXPORT_IDENTITY_MISMATCH');
        if (typeof r.months !== 'number' && typeof r.months !== 'string')
          throw new Error('PAYMENTS_EXPORT_INVALID_MONTHS');
        const months = Number(r.months);
        if (!Number.isSafeInteger(months) || months < 1 || months > 120)
          throw new Error('PAYMENTS_EXPORT_INVALID_MONTHS');
        return {
          id: id(r.id),
          communityReference: id(r.communityId),
          businessPageReference:
            r.businessPageId == null ? null : id(r.businessPageId),
          userId: id(a),
          type: enumValue(r.type, ['sticky-ad', 'banner', 'featured']),
          amount: decimal(r.amount),
          status: enumValue(r.status, [
            'pending',
            'active',
            'expired',
            'cancelled',
          ]),
          createdAt: timestamp(r.createdAt),
          startsAt: timestamp(r.startsAt),
          expiresAt: timestamp(r.expiresAt),
          months,
          ...recorded,
        };
      }
    ),
    source(
      'LemonSqueezyProduct',
      'lemon_squeezy_products',
      ['id'],
      '($1::uuid IS NOT NULL AND FALSE)',
      () => {
        throw new Error('PAYMENTS_EXPORT_EXCLUDED_SOURCE');
      }
    ),
  ];
  if (
    sources.map((item) => item.source).join('|') !==
    PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES.join('|')
  )
    throw new Error('PAYMENTS_EXPORT_SOURCE_REGISTRY_MISMATCH');
  // Donation profile IDs are optional but, when present, must resolve inside the captured identity snapshot.
  sources[0].sql = sources[0].sql.replace(
    'FROM "donations" r',
    `, (r."profileId" IS NULL OR EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE identities.id=r."profileId")) AS "profileBindingValid" FROM "donations" r`
  );
  sources[7].sql = sources[7].sql.replace(
    'FROM "business_themes" r',
    ', EXISTS (SELECT 1 FROM business_pages p WHERE p.id=r."businessPageId" AND p."ownerId"=$1::uuid) AS "subjectBindingValid" FROM "business_themes" r'
  );
  return sources;
}
