import inventory from './classifieds-account-export-dispositions.json';

const columns = [
  'id',
  'title',
  'description',
  'price',
  'currency',
  'category',
  'condition',
  'imageUrls',
  'status',
  'communityId',
  'profileId',
  'userId',
  'appScope',
  'isFeatured',
  'featuredUntil',
  'createdAt',
  'updatedAt',
  'expiresAt',
];
const actions: Record<string, string> = {
  id: 'include-owned',
  title: 'typed-projection',
  description: 'typed-projection',
  price: 'typed-projection',
  currency: 'typed-projection',
  category: 'typed-projection',
  condition: 'typed-projection',
  imageUrls: 'exclude',
  status: 'typed-projection',
  communityId: 'opaque-reference',
  profileId: 'typed-projection',
  userId: 'typed-projection',
  appScope: 'typed-projection',
  isFeatured: 'typed-projection',
  featuredUntil: 'typed-projection',
  createdAt: 'typed-projection',
  updatedAt: 'typed-projection',
  expiresAt: 'typed-projection',
};
const record = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: string[], b: string[]) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((x, i) => x === [...b].sort()[i]);
const safePath = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(v) &&
  !v.split('/').includes('..');

export const CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY = inventory;
export function validateClassifiedsDispositions(
  raw: readonly any[],
  value: unknown = inventory,
  physical?: Array<{ table: string; columns: string[] }>
): string[] {
  const errors: string[] = [];
  if (
    !Array.isArray(raw) ||
    raw.length !== 1 ||
    !record(raw[0]) ||
    !Array.isArray(raw[0]['columns']) ||
    !Array.isArray(raw[0]['relations']) ||
    !record(value) ||
    value['version'] !== 1 ||
    !Array.isArray(value['entities']) ||
    !Array.isArray(value['stores']) ||
    !record(value['selection']?.selector)
  )
    return ['invalid inventory shape'];
  const meta = raw.map((e: any) => ({
    name: e.name,
    table: e.tableName ?? e.table,
    columns: e.columns.map((c: any) => c.databaseName ?? c.database),
    relations: e.relations.map((r: any) => r.propertyName ?? r.property),
  }));
  if (
    meta[0].name !== 'ClassifiedAdEntity' ||
    meta[0].table !== 'classified_ad' ||
    !same(meta[0].columns, columns) ||
    meta[0].relations.length
  )
    errors.push('ClassifiedAdEntity metadata drift');
  if (
    value['entities'].length !== 1 ||
    value['entities'][0]?.name !== 'ClassifiedAdEntity'
  )
    errors.push('entity inventory drift');
  const entity = value['entities'][0];
  if (
    entity &&
    (entity.table !== 'classified_ad' ||
      !safePath(entity.source) ||
      !Array.isArray(entity.columns) ||
      !Array.isArray(entity.relations))
  )
    errors.push('entity inventory malformed');
  else if (entity) {
    const covered: string[] = [];
    for (const group of [...entity.columns, ...entity.relations]) {
      if (
        !record(group) ||
        !Array.isArray(group['fields']) ||
        !group['fields'].length ||
        !['owned', 'shared', 'opaque', 'nonpersonal'].includes(
          group['classification']
        ) ||
        ![
          'include-owned',
          'opaque-reference',
          'exclude',
          'typed-projection',
        ].includes(group['action']) ||
        typeof group['handling'] !== 'string' ||
        typeof group['reason'] !== 'string' ||
        !Array.isArray(group['evidence']) ||
        !group['evidence'].length ||
        group['evidence'].some((p: unknown) => !safePath(p))
      ) {
        errors.push('invalid disposition group');
        continue;
      }
      covered.push(...group['fields']);
      for (const field of group['fields'])
        if (actions[field] !== group['action'])
          errors.push(`disposition action drift: ${field}`);
    }
    if (!same(covered, columns))
      errors.push('column disposition coverage drift');
    if (entity.relations.length) errors.push('unexpected relation metadata');
  }
  const expectedStores = [
    'typeorm_migrations_store',
    'processOutput',
    'configurationInputs',
  ];
  if (
    !same(
      value['stores'].map((store: any) => store?.name),
      expectedStores
    ) ||
    value['stores'].some(
      (s: any) =>
        !record(s) ||
        !expectedStores.includes(s['name']) ||
        !Array.isArray(s['fields']) ||
        !s['fields'].length ||
        s['action'] !== 'exclude' ||
        typeof s['handling'] !== 'string' ||
        typeof s['reason'] !== 'string' ||
        !Array.isArray(s['evidence']) ||
        !s['evidence'].length ||
        !same(
          s['fields'],
          (
            {
              typeorm_migrations_store: ['id', 'timestamp', 'name'],
              processOutput: ['stdout', 'stderr', 'logs'],
              configurationInputs: [
                'database credentials',
                'service endpoints',
              ],
            } as Record<string, string[]>
          )[s['name']]
        ) ||
        s['evidence'].some((p: unknown) => !safePath(p))
    )
  )
    errors.push('store disposition drift');
  if (
    value['selection'].selector.profileSource !==
      'captured current identity IDs from Profile snapshot' ||
    !same(value['selection'].selector.appScopes, [
      'client-interface',
      'local-hub',
    ]) ||
    value['selection'].selector.statusFilter !== false ||
    value['selection'].principal !== 'account-owned-classified-ad-records' ||
    value['selection'].selector.profileBinding !==
      'query all account candidates in client-interface/local-hub scope and fail capture if a candidate profileId is not in the captured identity table' ||
    !same(value['selection'].selector.historicalStatuses, [
      'active',
      'sold',
      'expired',
      'removed',
    ]) ||
    value['selection'].selector.provenance !==
      'recorded attribution only; consent, exclusive ownership and current authority are not inferred'
  )
    errors.push('selection policy drift');
  if (physical) {
    if (
      !same(
        physical.map((t) => t.table),
        ['classified_ad', 'migrations']
      )
    )
      errors.push('physical table catalog drift');
    const expected: Record<string, string[]> = {
      classified_ad: columns,
      migrations: ['id', 'timestamp', 'name'],
    };
    for (const table of physical)
      if (!expected[table.table] || !same(table.columns, expected[table.table]))
        errors.push(`physical columns drift: ${table.table}`);
    if (physical.reduce((n, t) => n + t.columns.length, 0) !== 21)
      errors.push('physical column count drift');
  }
  return errors;
}
