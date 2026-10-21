import type { EntityMetadata } from 'typeorm';

export interface DispositionMetadata {
  name: string;
  table: string;
  tableType?: string;
  columns: Array<{ database: string }>;
  relations: Array<{ property: string }>;
}

const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const relativeSource = (value: unknown): value is string =>
  text(value) &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(value) &&
  !value.split('/').includes('..');
const same = (left: string[], right: string[]) =>
  left.length === right.length &&
  new Set(left).size === left.length &&
  [...left].sort().every((v, i) => v === [...right].sort()[i]);
const requiredStores: Record<string, string[]> = {
  typeorm_migrations_store: ['id', 'timestamp', 'name'],
  'NotificationService.pendingNotifications': ['data', 'count', 'timeout'],
  'Social.processOutput': ['message', 'context', 'timestamp'],
  'Social.configurationInputs': ['configuration'],
};

/** Checks reviewed policy coverage, not whether a capture implementation enforces it. */
export function validateSocialDispositions(
  rawMetadata: readonly (EntityMetadata | DispositionMetadata)[],
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
  const metadatas: DispositionMetadata[] = rawMetadata.map((m: any) => ({
    name: m.name,
    table: m.tableName ?? m.table,
    tableType: m.tableType,
    columns: m.columns.map((c: any) => ({
      database: c.databaseName ?? c.database,
    })),
    relations: m.relations.map((r: any) => ({
      property: r.propertyName ?? r.property,
    })),
  }));
  const junction = (m: DispositionMetadata) =>
    m.tableType === 'junction' || m.name === 'post_link';
  const groups = (value: unknown, expected: string[], label: string) => {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array`);
      return;
    }
    const seen: string[] = [];
    for (const group of value) {
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
        group.evidence.some((p: unknown) => !relativeSource(p))
      )
        errors.push(`${label} requires safe relative evidence`);
      for (const field of group.fields) {
        if (!text(field)) {
          errors.push(`${label} invalid field`);
          continue;
        }
        if (seen.includes(field)) errors.push(`${label} duplicates ${field}`);
        seen.push(field);
      }
    }
    for (const field of expected)
      if (!seen.includes(field)) errors.push(`${label} omits ${field}`);
    for (const field of seen)
      if (!expected.includes(field)) errors.push(`${label} extra ${field}`);
  };
  const index = (items: any[], label: string) => {
    const map = new Map<string, any>();
    for (const item of items) {
      if (!record(item) || !text(item.name)) {
        errors.push(`${label} invalid name`);
        continue;
      }
      if (map.has(item.name)) errors.push(`${label} duplicate ${item.name}`);
      map.set(item.name, item);
      if (!relativeSource(item.source))
        errors.push(`${item.name} invalid source`);
    }
    return map;
  };
  const entities = index(inventory.entities, 'entities');
  const associations = index(inventory.associations, 'associations');
  for (const m of metadatas) {
    const policies = junction(m) ? associations : entities;
    const p = policies.get(m.name);
    if (!p) {
      errors.push(
        `missing ${junction(m) ? 'association' : 'entity'} ${m.name}`
      );
      continue;
    }
    if (p.table !== m.table) errors.push(`${m.name} table mismatch`);
    groups(
      p.columns,
      m.columns.map((c) => c.database),
      `${m.name}.columns`
    );
    if (junction(m)) {
      if (
        !Array.isArray(p.columnNames) ||
        !same(
          p.columnNames,
          m.columns.map((c) => c.database)
        )
      )
        errors.push(`${m.name} association columnNames mismatch`);
    } else {
      groups(
        p.relations,
        m.relations.map((r) => r.property),
        `${m.name}.relations`
      );
      const s = p.subject;
      if (
        !record(s) ||
        ![
          'account',
          'profile',
          'account-and-profile',
          'recipient-profile',
          'viewer-account',
          'recorded-attribution-only',
          'none',
        ].includes(s.kind) ||
        !text(s.rule) ||
        !Array.isArray(s.fields) ||
        !text(s.legacyProvenance)
      ) {
        errors.push(`${m.name} invalid subject/provenance`);
        continue;
      }
      if (
        !Array.isArray(s.evidence) ||
        !s.evidence.length ||
        s.evidence.some((p: unknown) => !relativeSource(p))
      )
        errors.push(`${m.name} missing subject evidence`);
      if (!/unverified|unknown/i.test(s.legacyProvenance))
        errors.push(`${m.name} missing legacy uncertainty`);
      if (
        new Set(s.fields).size !== s.fields.length ||
        s.fields.some((f: unknown) => !m.columns.some((c) => c.database === f))
      )
        errors.push(`${m.name} invalid subject columns`);
      if (
        ['account', 'profile', 'recipient-profile', 'viewer-account'].includes(
          s.kind
        ) &&
        s.fields.length !== 1
      )
        errors.push(`${m.name} invalid principal selector`);
      if (s.kind === 'account-and-profile' && s.fields.length !== 2)
        errors.push(`${m.name} invalid paired selector`);
    }
  }
  for (const name of entities.keys())
    if (!metadatas.some((m) => !junction(m) && m.name === name))
      errors.push(`extra entity ${name}`);
  for (const name of associations.keys())
    if (!metadatas.some((m) => junction(m) && m.name === name))
      errors.push(`extra association ${name}`);
  const stores = index(inventory.stores, 'stores');
  const expectedTables = new Map(
    metadatas.map((m) => [m.table, m.columns.map((c) => c.database)])
  );
  for (const [name, s] of stores) {
    if (
      !['schema', 'volatile', 'external', 'operational-input'].includes(
        s.kind
      ) ||
      !text(s.reason) ||
      !text(s.handling)
    )
      errors.push(`${name} invalid store policy`);
    const expected = requiredStores[name];
    if (!expected) errors.push(`unreviewed store ${name}`);
    groups(s.columns, expected ?? [], `${name}.columns`);
    if (!Array.isArray(s.columnNames) || !same(s.columnNames, expected ?? []))
      errors.push(`${name} store columns mismatch`);
    if (s.kind === 'schema') {
      if (s.table !== 'migrations' || expectedTables.has(s.table))
        errors.push(`${name} invalid schema store`);
      else expectedTables.set(s.table, expected ?? []);
    }
  }
  for (const name of Object.keys(requiredStores))
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
