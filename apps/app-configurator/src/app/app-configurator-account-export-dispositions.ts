import type { EntityMetadata } from 'typeorm';
import inventory from './app-configurator-account-export-dispositions.json';

type Meta = {
  name: string;
  table: string;
  columns: Array<{ database: string }>;
  relations: Array<{ property: string }>;
};
const record = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Pure metadata and inventory parity validator. Optional physical catalog is read-only input. */
export function validateAppConfiguratorDispositions(
  raw: readonly (EntityMetadata | Meta)[],
  policy: unknown,
  physical?: Array<{ table: string; columns: string[] }>
): string[] {
  const errors: string[] = [];
  if (
    !record(policy) ||
    policy.version !== 1 ||
    !Array.isArray(policy.entities) ||
    !Array.isArray(policy.associations) ||
    !Array.isArray(policy.stores)
  )
    return ['invalid inventory shape'];
  if (
    policy.entities.some(
      (e: unknown) =>
        !record(e) ||
        typeof e.name !== 'string' ||
        !Array.isArray(e.columns) ||
        !Array.isArray(e.relations) ||
        !record(e.subject) ||
        !Array.isArray(e.subject.fields) ||
        [...e.columns, ...e.relations].some(
          (g: unknown) =>
            !record(g) ||
            !Array.isArray(g.fields) ||
            g.fields.some((f: unknown) => typeof f !== 'string')
        )
    ) ||
    policy.stores.some(
      (s: unknown) =>
        !record(s) || typeof s.name !== 'string' || !Array.isArray(s.fields)
    ) ||
    (physical &&
      physical.some(
        (t) =>
          !record(t) || typeof t.table !== 'string' || !Array.isArray(t.columns)
      ))
  )
    return ['invalid nested inventory shape'];
  const safeEvidence = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (path) =>
        typeof path === 'string' &&
        !path.startsWith('/') &&
        !path.includes('\\') &&
        path
          .split('/')
          .every((part) => part && part !== '.' && part !== '..') &&
        /^[A-Za-z0-9._/-]+$/.test(path)
    );
  const expected: Record<string, string[]> = {
    AccountDeletionWriteFenceEntity: [
      'key',
      'kind',
      'operationId',
      'installedAt',
    ],
    AppConfigurationEntity: [
      'id',
      'name',
      'workspaceId',
      'appInstanceId',
      'ownerUserId',
      'ownerProfileId',
      'appScope',
      'description',
      'domain',
      'landingPage',
      'routes',
      'features',
      'theme',
      'manifest',
      'active',
      'accessPolicy',
      'revision',
      'release',
      'createdAt',
      'updatedAt',
    ],
    AppInstanceEntity: [
      'id',
      'workspaceId',
      'appScope',
      'ownerUserId',
      'ownerProfileId',
      'status',
      'createdAt',
      'updatedAt',
    ],
    AppMembershipEntity: [
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
  };
  if (raw.length !== 4)
    errors.push(
      'registered entities must contain three content entities and their operational fence'
    );
  const entityNames = [
    'AccountDeletionWriteFenceEntity',
    'AppConfigurationEntity',
    'AppInstanceEntity',
    'AppMembershipEntity',
  ];
  if (
    !same(
      policy.entities.map((e: any) => e.name),
      entityNames
    )
  )
    errors.push('entity inventory drift');
  const byName = new Map(policy.entities.map((e: any) => [e.name, e]));
  if (byName.size !== policy.entities.length)
    errors.push('duplicate entity inventory');
  for (const item of raw as any[]) {
    const name = item.name,
      table = item.tableName ?? item.table,
      entity = byName.get(name);
    if (!entity) {
      errors.push(`missing entity ${name}`);
      continue;
    }
    if (entity.table !== table) errors.push(`${name} table mismatch`);
    const cols = (item.columns ?? []).map(
      (c: any) => c.database ?? c.databaseName
    );
    const columns = Array.isArray(entity.columns) ? entity.columns : [];
    const relations = Array.isArray(entity.relations) ? entity.relations : [];
    const groups = columns.flatMap((g: any) =>
      Array.isArray(g?.fields) ? g.fields : []
    );
    if (!same(cols, expected[name] ?? []))
      errors.push(`${name} metadata columns drift`);
    if (!same(groups, cols)) errors.push(`${name} column policy drift`);
    const rels = (item.relations ?? []).map(
      (r: any) => r.property ?? r.propertyName
    );
    const policyRels = relations.flatMap((g: any) =>
      Array.isArray(g?.fields) ? g.fields : []
    );
    if (!same(rels, policyRels)) errors.push(`${name} relation policy drift`);
    for (const g of [
      ...(Array.isArray(entity.columns) ? entity.columns : []),
      ...(Array.isArray(entity.relations) ? entity.relations : []),
    ])
      if (
        ![
          'include-owned',
          'typed-projection',
          'exclude',
          'opaque-reference',
          'template',
        ].includes(g?.action) ||
        !['owned', 'shared', 'nonpersonal', 'sensitive'].includes(
          g?.classification
        ) ||
        !g?.handling ||
        !g?.reason ||
        !safeEvidence(g?.evidence)
      )
        errors.push(`${name} invalid disposition group`);
  }
  const requiredStores = [
    'typeorm_migrations_store',
    'processOutput',
    'configurationInputs',
  ];
  if (
    !same(
      policy.stores.map((s: any) => s.name),
      requiredStores
    )
  )
    errors.push('store inventory drift');
  const storeRules: Record<
    string,
    { fields: string[]; classification: string; kind: string; table?: string }
  > = {
    typeorm_migrations_store: {
      fields: ['id', 'timestamp', 'name'],
      classification: 'nonpersonal',
      kind: 'schema',
      table: 'migrations',
    },
    processOutput: {
      fields: ['external shared process output'],
      classification: 'shared',
      kind: 'external',
    },
    configurationInputs: {
      fields: ['opaque credentials'],
      classification: 'opaque',
      kind: 'operational-input',
    },
  };
  if (
    new Set(policy.stores.map((s: any) => s.name)).size !== policy.stores.length
  )
    errors.push('duplicate store inventory');
  for (const store of policy.stores) {
    const rule = storeRules[store.name];
    if (
      !rule ||
      !same(store.fields, rule.fields) ||
      store.classification !== rule.classification ||
      store.action !== 'exclude' ||
      store.kind !== rule?.kind ||
      (rule?.table !== undefined && store.table !== rule.table) ||
      !store.reason ||
      !store.handling ||
      !safeEvidence(store.evidence)
    )
      errors.push(`invalid store disposition ${store.name}`);
  }
  const selector = policy.selection?.selector;
  if (
    !selector ||
    selector.operator !== 'AND' ||
    selector.profileSet !== 'capturedCurrentProfileIds' ||
    selector.currentProfileRequired !== true ||
    policy.selection?.appId !== 'authenticates request; never filters rows'
  )
    errors.push('selector policy drift');
  const expectedSubjects: Record<string, string[]> = {
    AppConfigurationEntity: ['ownerUserId', 'ownerProfileId'],
    AppInstanceEntity: ['ownerUserId', 'ownerProfileId'],
    AppMembershipEntity: ['userId', 'profileId'],
  };
  for (const entity of policy.entities) {
    if (entity.name === 'AccountDeletionWriteFenceEntity') {
      if (
        entity.subject?.kind !== 'none' ||
        entity.subject.fields.length ||
        entity.columns.some(
          (g: any) =>
            g.action !== 'exclude' || g.classification !== 'nonpersonal'
        )
      )
        errors.push('operational fence must be excluded');
      continue;
    }
    const entityRelations = Array.isArray(entity.relations)
      ? entity.relations
      : [];
    if (
      !same(
        entity.subject?.fields ?? [],
        expectedSubjects[entity.name] ?? []
      ) ||
      entity.subject?.kind !== 'account-and-profile' ||
      !String(entity.subject?.rule ?? '').includes(
        'Both captured account UUID and current captured profile required'
      ) ||
      entity.subject?.selector?.operator !== 'AND' ||
      entity.subject?.selector?.accountField !==
        (expectedSubjects[entity.name] ?? [])[0] ||
      entity.subject?.selector?.profileField !==
        (expectedSubjects[entity.name] ?? [])[1] ||
      entity.subject?.selector?.profileSet !== 'capturedCurrentProfileIds' ||
      entity.subject?.selector?.currentProfileRequired !== true ||
      entity.subject?.selector?.statusFilter !== false ||
      entity.subject?.parentPolicy !==
        (entity.name === 'AppConfigurationEntity'
          ? 'composite-parent-and-recorded-owner-pair'
          : entity.name === 'AppMembershipEntity'
          ? 'composite-parent-exists-no-owner-projection'
          : 'none') ||
      !safeEvidence(entity.subject?.evidence)
    )
      errors.push(`${entity.name} subject selector drift`);
    const fields = (
      Array.isArray(entity.columns) ? entity.columns : []
    ).flatMap((g: any) => (Array.isArray(g?.fields) ? g.fields : []));
    if (new Set(fields).size !== fields.length)
      errors.push(`${entity.name} duplicate column disposition`);
    if (
      entity.name === 'AppConfigurationEntity' &&
      ![
        'description',
        'landingPage',
        'routes',
        'features',
        'theme',
        'manifest',
        'release',
      ].every((f: string) =>
        (Array.isArray(entity.columns) ? entity.columns : []).some(
          (g: any) =>
            Array.isArray(g?.fields) &&
            g.fields.includes(f) &&
            g.action === 'exclude'
        )
      )
    )
      errors.push('configuration payload exclusions drift');
    if (
      entity.name === 'AppConfigurationEntity' &&
      ![
        'description',
        'landingPage',
        'routes',
        'features',
        'theme',
        'manifest',
        'release',
      ].every((field) =>
        (Array.isArray(entity.columns) ? entity.columns : []).some(
          (g: any) =>
            Array.isArray(g?.fields) &&
            same(g.fields, [
              'description',
              'landingPage',
              'routes',
              'features',
              'theme',
              'manifest',
              'release',
            ]) &&
            g.classification === 'shared' &&
            g.action === 'exclude' &&
            g.handling === 'Never selected or emitted.'
        )
      )
    )
      errors.push('configuration payload exclusion details drift');
    if (
      entityRelations.length &&
      entityRelations.some(
        (g: any) =>
          g.action !== 'typed-projection' ||
          !String(g?.handling).includes('composite') ||
          !safeEvidence(g?.evidence)
      )
    )
      errors.push(`${entity.name} composite relation policy drift`);
  }
  if (!policy.stores.every((s: any) => s.action === 'exclude'))
    errors.push('store disposition drift');
  if (policy.associations.length)
    errors.push('unexpected association inventory');
  if (physical) {
    const seen = new Set<string>();
    const expectedTables = [
      ...(raw as any[]).map((m) => m.tableName ?? m.table),
      'migrations',
    ];
    for (const table of physical) {
      if (seen.has(table.table))
        errors.push(`duplicate physical table ${table.table}`);
      seen.add(table.table);
      if (!expectedTables.includes(table.table))
        errors.push(`unexpected physical table ${table.table}`);
      const item = (raw as any[]).find(
        (m) => (m.tableName ?? m.table) === table.table
      );
      if (
        item &&
        !same(
          (item.columns ?? []).map((c: any) => c.database ?? c.databaseName),
          table.columns
        )
      )
        errors.push(`physical columns drift ${table.table}`);
    }
    for (const item of raw as any[])
      if (!seen.has(item.tableName ?? item.table))
        errors.push(`missing physical table ${item.tableName ?? item.table}`);
    const migration = physical.find((table) => table.table === 'migrations');
    if (!migration || !same(migration.columns, ['id', 'timestamp', 'name']))
      errors.push('migration physical columns drift');
  }
  return errors;
}

export const APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY = inventory;
