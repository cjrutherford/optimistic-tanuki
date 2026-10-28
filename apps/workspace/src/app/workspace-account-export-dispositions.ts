import type { EntityMetadata } from 'typeorm';

export interface WorkspaceDispositionMetadata {
  name: string;
  table: string;
  tableType?: string;
  columns: Array<{ database: string }>;
  relations: Array<{ property: string }>;
}

const REQUIRED_STORES: Record<string, string[]> = {
  typeorm_migrations_store: ['id', 'timestamp', 'name'],
  'Workspace.processOutput': ['message', 'context', 'timestamp'],
  'Workspace.configurationInputs': ['configuration', 'seedDefinitions'],
};
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const safePath = (value: unknown): value is string =>
  text(value) &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(value) &&
  !value.split('/').includes('..');
const same = (left: string[], right: string[]) =>
  left.length === right.length &&
  new Set(left).size === left.length &&
  [...left].sort().every((value, i) => value === [...right].sort()[i]);

/** Validates reviewed policy, TypeORM metadata, and optional physical catalog; no export is performed. */
export function validateWorkspaceDispositions(
  rawMetadata: readonly (EntityMetadata | WorkspaceDispositionMetadata)[],
  inventory: unknown,
  physical?: Array<{ table: string; columns: string[] }>
): string[] {
  const errors: string[] = [];
  if (
    !record(inventory) ||
    inventory.version !== 1 ||
    !Array.isArray(inventory.entities) ||
    !Array.isArray(inventory.associations) ||
    !Array.isArray(inventory.stores)
  )
    return [
      'inventory must be version 1 with entities, associations, and stores arrays',
    ];

  const metadata: WorkspaceDispositionMetadata[] = rawMetadata.map(
    (item: any) => ({
      name: item.name,
      table: item.tableName ?? item.table,
      tableType: item.tableType,
      columns: (item.columns ?? []).map((column: any) => ({
        database: column.databaseName ?? column.database,
      })),
      relations: (item.relations ?? []).map((relation: any) => ({
        property: relation.propertyName ?? relation.property,
      })),
    })
  );
  const metadataNames = metadata.map((item) => item.name);
  const metadataTables = metadata.map((item) => item.table);
  if (new Set(metadataNames).size !== metadataNames.length)
    errors.push('metadata duplicate entity');
  if (new Set(metadataTables).size !== metadataTables.length)
    errors.push('metadata duplicate table');
  for (const item of metadata) {
    const columns = item.columns.map((column) => column.database);
    const relations = item.relations.map((relation) => relation.property);
    if (new Set(columns).size !== columns.length)
      errors.push(`${item.name} metadata duplicate column`);
    if (new Set(relations).size !== relations.length)
      errors.push(`${item.name} metadata duplicate relation`);
  }
  const index = (items: any[], label: string, requireSource = true) => {
    const result = new Map<string, any>();
    for (const item of items) {
      if (!record(item) || !text(item.name)) {
        errors.push(`${label} invalid name`);
        continue;
      }
      if (result.has(item.name)) errors.push(`${label} duplicate ${item.name}`);
      result.set(item.name, item);
      if (requireSource && !safePath(item.source))
        errors.push(`${item.name} invalid source`);
    }
    return result;
  };
  const validateGroups = (
    groups: unknown,
    expected: string[],
    label: string
  ) => {
    if (!Array.isArray(groups)) {
      errors.push(`${label} must be an array`);
      return;
    }
    const seen: string[] = [];
    for (const group of groups) {
      if (
        !record(group) ||
        !Array.isArray(group.fields) ||
        !group.fields.length
      ) {
        errors.push(`${label} invalid field group`);
        continue;
      }
      if (
        !['owned', 'shared', 'opaque', 'nonpersonal'].includes(
          group.classification
        )
      )
        errors.push(`${label} invalid classification`);
      if (
        ![
          'include-owned',
          'opaque-reference',
          'template',
          'exclude',
          'typed-projection',
        ].includes(group.action)
      )
        errors.push(`${label} invalid action`);
      if (!text(group.handling) || !text(group.reason))
        errors.push(`${label} missing handling/reason`);
      if (
        !Array.isArray(group.evidence) ||
        !group.evidence.length ||
        group.evidence.some((item: unknown) => !safePath(item))
      )
        errors.push(`${label} requires safe relative evidence`);
      for (const field of group.fields) {
        if (!text(field)) errors.push(`${label} invalid field`);
        else {
          if (seen.includes(field)) errors.push(`${label} duplicates ${field}`);
          seen.push(field);
        }
      }
    }
    for (const field of expected)
      if (!seen.includes(field)) errors.push(`${label} omits ${field}`);
    for (const field of seen)
      if (!expected.includes(field)) errors.push(`${label} extra ${field}`);
  };

  const entities = index(inventory.entities, 'entities');
  const associations = index(inventory.associations, 'associations');
  if (
    !same(
      metadata.map((item) => item.name),
      ['Workspace', 'AccountDeletionWriteFenceEntity']
    )
  )
    errors.push(
      'registered entities must contain Workspace and its operational fence'
    );
  for (const item of metadata) {
    if (item.tableType === 'junction') {
      errors.push(`unexpected association metadata ${item.name}`);
      continue;
    }
    const policy = entities.get(item.name);
    if (!policy) {
      errors.push(`missing entity ${item.name}`);
      continue;
    }
    if (policy.table !== item.table) errors.push(`${item.name} table mismatch`);
    validateGroups(
      policy.columns,
      item.columns.map((column) => column.database),
      `${item.name}.columns`
    );
    validateGroups(
      policy.relations,
      item.relations.map((relation) => relation.property),
      `${item.name}.relations`
    );
    if (item.relations.length)
      errors.push(`${item.name} relations are prohibited`);
    if (item.name === 'AccountDeletionWriteFenceEntity') {
      if (
        policy.subject?.kind !== 'none' ||
        !Array.isArray(policy.subject.fields) ||
        policy.subject.fields.length ||
        policy.columns.some(
          (group: any) =>
            group.action !== 'exclude' || group.classification !== 'opaque'
        )
      )
        errors.push('operational fence must be excluded');
      continue;
    }
    const expectedPolicy: Record<string, string> = {
      id: 'include-owned:owned',
      kind: 'include-owned:owned',
      slug: 'typed-projection:shared',
      displayName: 'typed-projection:shared',
      appScope: 'typed-projection:shared',
      status: 'include-owned:owned',
      sourceService: 'typed-projection:shared',
      sourceId: 'opaque-reference:opaque',
      ownerUserId: 'include-owned:owned',
      ownerProfileId: 'include-owned:owned',
      createdAt: 'include-owned:owned',
      updatedAt: 'include-owned:owned',
    };
    for (const [field, expected] of Object.entries(expectedPolicy)) {
      const group = policy.columns.find(
        (candidate: any) =>
          Array.isArray(candidate.fields) && candidate.fields.includes(field)
      );
      if (!group || `${group.action}:${group.classification}` !== expected)
        errors.push(`${item.name}.${field} policy mismatch`);
    }
    const selector = inventory.selection?.selector;
    if (
      inventory.selection?.accountScope !==
        'account-wide across appScope values' ||
      inventory.selection?.appId !==
        'authenticates request; never filters rows' ||
      !Array.isArray(inventory.selection?.limitations) ||
      !inventory.selection.limitations.some(
        (value: unknown) =>
          typeof value === 'string' && /unverified/i.test(value)
      ) ||
      !record(selector) ||
      selector.operator !== 'AND' ||
      selector.accountField !== 'ownerUserId' ||
      selector.profileField !== 'ownerProfileId' ||
      selector.profileSet !== 'capturedCurrentProfileIds' ||
      selector.currentProfileRequired !== true
    )
      errors.push(`${item.name} selection policy mismatch`);
    const subject = policy.subject;
    if (
      !record(subject) ||
      subject.kind !== 'account-and-profile' ||
      !text(subject.rule) ||
      !text(subject.legacyProvenance) ||
      !/unverified|unknown/i.test(subject.legacyProvenance) ||
      !Array.isArray(subject.fields) ||
      !same(subject.fields, ['ownerUserId', 'ownerProfileId'])
    )
      errors.push(`${item.name} subject selector mismatch`);
    if (
      record(subject) &&
      (!Array.isArray(subject.evidence) ||
        !subject.evidence.length ||
        subject.evidence.some((path: unknown) => !safePath(path)))
    )
      errors.push(`${item.name} missing subject evidence`);
  }
  for (const name of entities.keys())
    if (
      !metadata.some(
        (item) => item.name === name && item.tableType !== 'junction'
      )
    )
      errors.push(`extra entity ${name}`);
  for (const name of associations.keys())
    errors.push(`unexpected association ${name}`);
  if (associations.size) errors.push('associations must be empty');

  const stores = index(inventory.stores, 'stores', false);
  const expectedStorePolicy: Record<
    string,
    { kind: string; action: string; classification: string; table?: string }
  > = {
    typeorm_migrations_store: {
      kind: 'schema',
      action: 'exclude',
      classification: 'nonpersonal',
      table: 'migrations',
    },
    'Workspace.processOutput': {
      kind: 'external',
      action: 'exclude',
      classification: 'shared',
    },
    'Workspace.configurationInputs': {
      kind: 'operational-input',
      action: 'exclude',
      classification: 'opaque',
    },
  };
  const expectedTables = new Map(
    metadata.map((item) => [
      item.table,
      item.columns.map((column) => column.database),
    ])
  );
  for (const [name, store] of stores) {
    if (
      !['schema', 'volatile', 'external', 'operational-input'].includes(
        store.kind
      ) ||
      !text(store.reason) ||
      !text(store.handling)
    )
      errors.push(`${name} invalid store policy`);
    const expected = REQUIRED_STORES[name];
    const reviewed = expectedStorePolicy[name];
    if (!expected) errors.push(`unreviewed store ${name}`);
    if (
      !reviewed ||
      store.kind !== reviewed.kind ||
      (reviewed.table && store.table !== reviewed.table)
    )
      errors.push(`${name} store disposition mismatch`);
    validateGroups(store.columns, expected ?? [], `${name}.columns`);
    for (const group of Array.isArray(store.columns) ? store.columns : []) {
      if (
        !record(group) ||
        group.action !== reviewed?.action ||
        group.classification !== reviewed?.classification
      )
        errors.push(`${name} store field policy mismatch`);
    }
    if (
      !Array.isArray(store.columnNames) ||
      !same(store.columnNames, expected ?? [])
    )
      errors.push(`${name} store columns mismatch`);
    if (name === 'typeorm_migrations_store') {
      if (
        store.kind !== 'schema' ||
        store.table !== 'migrations' ||
        expectedTables.has('migrations')
      )
        errors.push(`${name} invalid schema store`);
      if (!expectedTables.has('migrations'))
        expectedTables.set('migrations', expected ?? []);
    }
  }
  for (const name of Object.keys(REQUIRED_STORES))
    if (!stores.has(name)) errors.push(`missing store ${name}`);
  if (physical) {
    const seen = new Set<string>();
    for (const row of physical) {
      if (!record(row) || !text(row.table) || !Array.isArray(row.columns)) {
        errors.push('invalid physical catalog row');
        continue;
      }
      if (seen.has(row.table))
        errors.push(`duplicate physical table ${row.table}`);
      seen.add(row.table);
      const expected = expectedTables.get(row.table);
      if (!expected) errors.push(`physical table unaccounted ${row.table}`);
      else if (!same(row.columns, expected))
        errors.push(`physical columns mismatch ${row.table}`);
    }
    for (const table of expectedTables.keys())
      if (!seen.has(table)) errors.push(`physical table missing ${table}`);
  }
  return [...new Set(errors)];
}
