import type { EntityMetadata } from 'typeorm';

export interface ForumDispositionMetadata {
  name: string;
  table: string;
  tableType?: string;
  columns: Array<{ database: string }>;
  relations: Array<{ property: string }>;
}

const ENTITY_NAMES = [
  'Topic',
  'Thread',
  'ForumPost',
  'ForumLink',
  'ForumReport',
  'ForumModerationAction',
];
const STORES: Record<string, string[]> = {
  typeorm_migrations_store: ['id', 'timestamp', 'name'],
  'Forum.processOutput': ['message', 'context', 'timestamp'],
  'Forum.configurationInputs': ['configuration', 'seedDefinitions'],
};
const record = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && !!x.trim();
const safePath = (x: unknown): x is string =>
  text(x) &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(x) &&
  !x.split('/').includes('..');
const same = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Validates J26 policy coverage and metadata/catalog parity; it does not implement export capture. */
export function validateForumDispositions(
  raw: readonly (EntityMetadata | ForumDispositionMetadata)[],
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
  const metadata: ForumDispositionMetadata[] = raw.map((m: any) => ({
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
  const junction = (m: ForumDispositionMetadata) => m.tableType === 'junction';
  const groups = (value: unknown, expected: string[], label: string) => {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array`);
      return;
    }
    const seen: string[] = [];
    for (const g of value) {
      if (!record(g) || !Array.isArray(g.fields) || !g.fields.length) {
        errors.push(`${label} invalid field group`);
        continue;
      }
      if (
        !['owned', 'shared', 'opaque', 'nonpersonal'].includes(g.classification)
      )
        errors.push(`${label} invalid classification`);
      if (
        ![
          'include-owned',
          'opaque-reference',
          'template',
          'exclude',
          'typed-projection',
        ].includes(g.action)
      )
        errors.push(`${label} invalid action`);
      if (!text(g.handling) || !text(g.reason))
        errors.push(`${label} missing handling/reason`);
      if (
        !Array.isArray(g.evidence) ||
        !g.evidence.length ||
        g.evidence.some((p: unknown) => !safePath(p))
      )
        errors.push(`${label} requires safe relative evidence`);
      for (const f of g.fields) {
        if (!text(f)) errors.push(`${label} invalid field`);
        else {
          if (seen.includes(f)) errors.push(`${label} duplicates ${f}`);
          seen.push(f);
        }
      }
    }
    for (const f of expected)
      if (!seen.includes(f)) errors.push(`${label} omits ${f}`);
    for (const f of seen)
      if (!expected.includes(f)) errors.push(`${label} extra ${f}`);
  };
  const index = (items: any[], label: string) => {
    const map = new Map<string, any>();
    for (const x of items) {
      if (!record(x) || !text(x.name)) {
        errors.push(`${label} invalid name`);
        continue;
      }
      if (map.has(x.name)) errors.push(`${label} duplicate ${x.name}`);
      map.set(x.name, x);
      if (!safePath(x.source)) errors.push(`${x.name} invalid source`);
    }
    return map;
  };
  const entities = index(inventory.entities, 'entities'),
    associations = index(inventory.associations, 'associations');
  for (const m of metadata) {
    const assoc = junction(m),
      p = (assoc ? associations : entities).get(m.name);
    if (!p) {
      errors.push(`missing ${assoc ? 'association' : 'entity'} ${m.name}`);
      continue;
    }
    if (p.table !== m.table) errors.push(`${m.name} table mismatch`);
    groups(
      p.columns,
      m.columns.map((c) => c.database),
      `${m.name}.columns`
    );
    if (assoc) {
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
          'recorded-attribution-only',
          'none',
        ].includes(s.kind) ||
        !text(s.rule) ||
        !Array.isArray(s.fields) ||
        !text(s.legacyProvenance)
      )
        errors.push(`${m.name} invalid subject/provenance`);
      else {
        if (
          !Array.isArray(s.evidence) ||
          !s.evidence.length ||
          s.evidence.some((v: unknown) => !safePath(v))
        )
          errors.push(`${m.name} missing subject evidence`);
        if (!/unverified|unknown/i.test(s.legacyProvenance))
          errors.push(`${m.name} missing legacy uncertainty`);
        if (
          new Set(s.fields).size !== s.fields.length ||
          s.fields.some(
            (f: unknown) => !m.columns.some((c) => c.database === f)
          )
        )
          errors.push(`${m.name} invalid subject columns`);
        if (['account', 'profile'].includes(s.kind) && s.fields.length !== 1)
          errors.push(`${m.name} invalid principal selector`);
        if (s.kind === 'account-and-profile' && s.fields.length !== 2)
          errors.push(`${m.name} invalid paired selector`);
      }
    }
  }
  for (const n of entities.keys())
    if (!metadata.some((m) => !junction(m) && m.name === n))
      errors.push(`extra entity ${n}`);
  for (const n of associations.keys())
    if (!metadata.some((m) => junction(m) && m.name === n))
      errors.push(`extra association ${n}`);
  const stores = index(inventory.stores, 'stores'),
    expectedTables = new Map(
      metadata.map((m) => [m.table, m.columns.map((c) => c.database)])
    );
  for (const [name, s] of stores) {
    const cols = STORES[name];
    if (!cols) errors.push(`unreviewed store ${name}`);
    if (
      !record(s) ||
      !['schema', 'volatile', 'external', 'operational-input'].includes(
        s.kind
      ) ||
      !text(s.reason) ||
      !text(s.handling)
    )
      errors.push(`${name} invalid store policy`);
    groups(s.columns, cols ?? [], `${name}.columns`);
    if (!Array.isArray(s.columnNames) || !same(s.columnNames, cols ?? []))
      errors.push(`${name} store columns mismatch`);
    if (s.kind === 'schema') {
      if (s.table !== 'migrations' || expectedTables.has(s.table))
        errors.push(`${name} invalid schema store`);
      else expectedTables.set(s.table, cols ?? []);
    }
  }
  for (const n of Object.keys(STORES))
    if (!stores.has(n)) errors.push(`missing store ${n}`);
  for (const [n, s] of stores)
    if (s.kind !== 'schema' && s.table !== undefined)
      errors.push(`${n} external/operational input cannot be a physical table`);
  if (physical) {
    const seen = new Set<string>();
    for (const r of physical) {
      if (!record(r) || !text(r.table) || !Array.isArray(r.columns)) {
        errors.push('invalid physical catalog row');
        continue;
      }
      if (seen.has(r.table)) errors.push(`duplicate physical table ${r.table}`);
      seen.add(r.table);
      const cols = expectedTables.get(r.table);
      if (!cols) errors.push(`physical table unaccounted ${r.table}`);
      else if (!same(cols, r.columns))
        errors.push(`physical columns mismatch ${r.table}`);
    }
    for (const t of expectedTables.keys())
      if (!seen.has(t)) errors.push(`physical table missing ${t}`);
  }
  const actual = metadata
    .filter((m) => !junction(m))
    .map((m) => m.name)
    .sort();
  if (!same(actual, [...ENTITY_NAMES].sort()))
    errors.push('Forum entity registration set mismatch');
  const required: Record<string, { kind: string; fields: string[] }> = {
    Topic: { kind: 'account-and-profile', fields: ['userId', 'profileId'] },
    Thread: { kind: 'account-and-profile', fields: ['userId', 'profileId'] },
    ForumPost: { kind: 'account-and-profile', fields: ['userId', 'profileId'] },
    ForumLink: { kind: 'recorded-attribution-only', fields: [] },
    ForumReport: { kind: 'profile', fields: ['reporterId'] },
    ForumModerationAction: { kind: 'profile', fields: ['actorProfileId'] },
  };
  for (const [n, r] of Object.entries(required)) {
    const s = entities.get(n)?.subject;
    if (
      !record(s) ||
      s.kind !== r.kind ||
      !same(Array.isArray(s.fields) ? s.fields : [], r.fields)
    )
      errors.push(`${n} subject selector mismatch`);
  }
  for (const [n, fields] of Object.entries({
    Topic: ['isPinned', 'isLocked'],
    Thread: [
      'isPinned',
      'isLocked',
      'viewCount',
      'moderationStatus',
      'moderationNotes',
      'moderatedBy',
      'moderatedAt',
    ],
    ForumPost: [
      'moderationStatus',
      'moderationNotes',
      'moderatedBy',
      'moderatedAt',
    ],
    ForumLink: ['title', 'description'],
    ForumReport: ['description', 'adminNotes'],
    ForumModerationAction: ['details'],
  })) {
    const policy = entities.get(n);
    if (policy && Array.isArray(policy.columns))
      for (const g of policy.columns)
        if (
          record(g) &&
          Array.isArray(g.fields) &&
          g.fields.some((f: string) => fields.includes(f)) &&
          g.action !== 'exclude'
        )
          errors.push(`${n} private/governance field exposure`);
  }
  return [...new Set(errors)];
}
