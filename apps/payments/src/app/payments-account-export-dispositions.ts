import { getMetadataArgsStorage } from 'typeorm';
import inventory from './payments-account-export-dispositions.json';

const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a: string[], b: string[]) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((value, index) => value === [...b].sort()[index]);
const safePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(value) &&
  !value.split('/').includes('..');
const sourceActions: Record<string, Record<string, string>> = {
  Donation: {
    id: 'include-owned',
    userId: 'typed-projection',
    profileId: 'typed-projection',
    amount: 'typed-projection',
    isRecurring: 'typed-projection',
    status: 'typed-projection',
    currency: 'typed-projection',
    createdAt: 'typed-projection',
    cancelledAt: 'typed-projection',
    lemonSqueezyOrderId: 'exclude',
    lemonSqueezySubscriptionId: 'exclude',
    message: 'exclude',
    anonymous: 'exclude',
  },
  ClassifiedPayment: {
    id: 'opaque-reference',
    classifiedId: 'opaque-reference',
    buyerId: 'typed-projection',
    sellerId: 'typed-projection',
    interestedBuyerId: 'exclude',
    amount: 'typed-projection',
    platformFeeAmount: 'exclude',
    sellerReceivesAmount: 'exclude',
    offerId: 'opaque-reference',
    paymentIntentId: 'exclude',
    paymentMethod: 'exclude',
    status: 'typed-projection',
    proofImageUrl: 'exclude',
    disputeReason: 'exclude',
    LemonSqueezyOrderId: 'exclude',
    createdAt: 'typed-projection',
    confirmedAt: 'typed-projection',
    releasedAt: 'typed-projection',
  },
  SellerWallet: {
    id: 'typed-projection',
    sellerId: 'typed-projection',
    availableBalance: 'typed-projection',
    pendingBalance: 'typed-projection',
    totalEarned: 'typed-projection',
    totalPaidOut: 'typed-projection',
    payoutMethod: 'exclude',
    payoutEmail: 'exclude',
    bankAccountLast4: 'exclude',
    bankRoutingLast4: 'exclude',
    createdAt: 'typed-projection',
    lastPayoutAt: 'typed-projection',
  },
  Transaction: {
    id: 'typed-projection',
    userId: 'typed-projection',
    type: 'typed-projection',
    direction: 'typed-projection',
    amount: 'typed-projection',
    platformFee: 'typed-projection',
    netAmount: 'typed-projection',
    feePercentage: 'exclude',
    currency: 'typed-projection',
    referenceId: 'opaque-reference',
    financeTransactionId: 'exclude',
    status: 'typed-projection',
    description: 'exclude',
    createdAt: 'typed-projection',
  },
  Offer: {
    id: 'opaque-reference',
    classifiedId: 'opaque-reference',
    buyerId: 'typed-projection',
    sellerId: 'typed-projection',
    offeredAmount: 'typed-projection',
    status: 'typed-projection',
    message: 'exclude',
    counterOfferAmount: 'exclude',
    counterMessage: 'exclude',
    expiresAt: 'typed-projection',
    acceptedPaymentId: 'opaque-reference',
    createdAt: 'typed-projection',
    updatedAt: 'typed-projection',
  },
  PayoutRequest: {
    id: 'typed-projection',
    sellerId: 'typed-projection',
    amount: 'typed-projection',
    status: 'typed-projection',
    payoutMethod: 'exclude',
    payoutEmail: 'exclude',
    bankAccountLast4: 'exclude',
    bankRoutingLast4: 'exclude',
    transactionId: 'exclude',
    rejectionReason: 'exclude',
    processedBy: 'exclude',
    createdAt: 'typed-projection',
    processedAt: 'typed-projection',
  },
  BusinessPage: {
    id: 'opaque-reference',
    communityId: 'opaque-reference',
    ownerId: 'typed-projection',
    name: 'typed-projection',
    description: 'exclude',
    logoUrl: 'exclude',
    website: 'exclude',
    phone: 'exclude',
    email: 'exclude',
    address: 'exclude',
    tier: 'typed-projection',
    lemonSqueezySubscriptionId: 'exclude',
    subscriptionStatus: 'typed-projection',
    pinnedPostId: 'exclude',
    createdAt: 'typed-projection',
    updatedAt: 'typed-projection',
    subscriptionExpiresAt: 'typed-projection',
    isCommunity: 'exclude',
    isFeatured: 'exclude',
    featuredSpotType: 'exclude',
    customSpotContent: 'exclude',
    customSpotImageUrl: 'exclude',
    customSpotGradient: 'exclude',
    businessThemeId: 'exclude',
  },
  BusinessTheme: {
    id: 'typed-projection',
    businessPageId: 'typed-projection',
    businessPage: 'exclude',
    personalityId: 'exclude',
    primaryColor: 'exclude',
    accentColor: 'exclude',
    backgroundColor: 'exclude',
    customCss: 'exclude',
    customFontFamily: 'exclude',
    createdAt: 'typed-projection',
    updatedAt: 'typed-projection',
  },
  CommunitySponsorship: {
    id: 'opaque-reference',
    communityId: 'opaque-reference',
    businessPageId: 'opaque-reference',
    userId: 'typed-projection',
    type: 'typed-projection',
    adContent: 'exclude',
    amount: 'typed-projection',
    lemonSqueezyOrderId: 'exclude',
    status: 'typed-projection',
    createdAt: 'typed-projection',
    startsAt: 'typed-projection',
    expiresAt: 'typed-projection',
    months: 'typed-projection',
  },
  LemonSqueezyProduct: {
    id: 'exclude',
    appScope: 'exclude',
    tier: 'exclude',
    lemonSqueezyProductId: 'exclude',
    lemonSqueezyVariantId: 'exclude',
    name: 'exclude',
    isActive: 'exclude',
    createdAt: 'exclude',
    updatedAt: 'exclude',
  },
};

export const PAYMENTS_ACCOUNT_EXPORT_INVENTORY = inventory;
export function validatePaymentsDispositions(
  entities: readonly any[],
  value: unknown = inventory
): string[] {
  const errors: string[] = [];
  if (
    !Array.isArray(entities) ||
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.entities) ||
    !Array.isArray(value.stores)
  )
    return ['invalid inventory shape'];
  const storage = getMetadataArgsStorage();
  const actual = entities.map((target: any) => {
    const table = storage.tables.find((entry) => entry.target === target);
    return {
      name: target.name,
      table: table?.name,
      columns: storage.columns
        .filter(
          (entry) =>
            entry.target === target &&
            !storage.relations.some(
              (relation) =>
                relation.target === target &&
                relation.propertyName === entry.propertyName
            )
        )
        .map((entry) => entry.propertyName),
      relations: storage.relations
        .filter((entry) => entry.target === target)
        .map((entry) => entry.propertyName),
    };
  });
  if (
    !same(
      actual.map((entity) => entity.name),
      value.entities.map((entity: any) => entity.name)
    )
  )
    errors.push('entity registry drift');
  for (const metadata of actual) {
    const entity = value.entities.find(
      (item: any) => item.name === metadata.name
    );
    if (!entity || metadata.table !== entity.table) {
      errors.push(`${metadata.name} table/entity drift`);
      continue;
    }
    const covered: string[] = [];
    const columnGroups = new Set(entity.columns ?? []);
    for (const group of [
      ...(entity.columns ?? []),
      ...(entity.relations ?? []),
    ]) {
      if (
        !record(group) ||
        !Array.isArray(group.fields) ||
        !group.fields.length ||
        !['owned', 'shared', 'opaque', 'nonpersonal'].includes(
          group.classification
        ) ||
        ![
          'include-owned',
          'opaque-reference',
          'exclude',
          'typed-projection',
        ].includes(group.action) ||
        typeof group.handling !== 'string' ||
        typeof group.reason !== 'string' ||
        !Array.isArray(group.evidence) ||
        !group.evidence.length ||
        group.evidence.some((path: unknown) => !safePath(path))
      ) {
        errors.push(`${metadata.name} invalid disposition group`);
        continue;
      }
      if (columnGroups.has(group)) covered.push(...group.fields);
      for (const field of group.fields)
        if (sourceActions[metadata.name]?.[field] !== group.action)
          errors.push(`${metadata.name} action drift: ${field}`);
    }
    if (!same(covered, metadata.columns))
      errors.push(`${metadata.name} column metadata coverage drift`);
    if (
      !same(
        entity.relations.map((relation: any) => relation.fields).flat(),
        metadata.relations
      )
    )
      errors.push(`${metadata.name} relation metadata coverage drift`);
  }
  const stores: Record<string, string[]> = {
    typeorm_migrations_store: ['id', 'timestamp', 'name'],
    processOutput: ['stdout', 'stderr', 'logs'],
    configurationInputs: ['database credentials', 'service endpoints'],
  };
  if (
    !same(
      value.stores.map((store: any) => store.name),
      Object.keys(stores)
    ) ||
    value.stores.some(
      (store: any) =>
        !record(store) ||
        store.action !== 'exclude' ||
        !same(store.fields, stores[store.name]) ||
        typeof store.handling !== 'string' ||
        typeof store.reason !== 'string' ||
        !Array.isArray(store.evidence) ||
        !store.evidence.length ||
        store.evidence.some((path: unknown) => !safePath(path))
    )
  )
    errors.push('store exclusion drift');
  if (
    value.selection?.appScope !==
      'not present on financial rows; no appScope filter is inferred' ||
    value.selection?.principal !==
      'subject-account-owned-and-shared-financial-records'
  )
    errors.push('selection policy drift');
  return errors;
}
