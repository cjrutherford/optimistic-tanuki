import inventory from './chat-account-export-dispositions.json';

type Metadata = {
  name: string;
  table: string;
  tableType?: string;
  columns: Array<{ database: string }>;
  relations: Array<{ property: string }>;
};
const expected = {
  AccountDeletionWriteFenceEntity: {
    table: 'account_deletion_write_fence',
    columns: ['key', 'kind', 'operationId', 'installedAt'],
    relations: [],
  },
  Conversation: {
    table: 'conversation',
    columns: [
      'id',
      'title',
      'type',
      'communityId',
      'projectId',
      'ownerId',
      'isDeleted',
      'createdAt',
      'updatedAt',
      'participants',
    ],
    relations: ['messages'],
  },
  Message: {
    table: 'message',
    columns: [
      'id',
      'content',
      'senderId',
      'type',
      'recipients',
      'conversationId',
      'createdAt',
      'updatedAt',
    ],
    relations: ['conversation'],
  },
} as const;
const fieldActions: Record<string, Record<string, string>> = {
  AccountDeletionWriteFenceEntity: {
    key: 'exclude',
    kind: 'exclude',
    operationId: 'exclude',
    installedAt: 'exclude',
  },
  Conversation: {
    id: 'include-owned',
    type: 'typed-projection',
    isDeleted: 'typed-projection',
    createdAt: 'typed-projection',
    updatedAt: 'typed-projection',
    title: 'exclude',
    communityId: 'exclude',
    projectId: 'exclude',
    ownerId: 'exclude',
    participants: 'exclude',
    messages: 'typed-projection',
  },
  Message: {
    id: 'include-owned',
    senderId: 'include-owned',
    conversationId: 'include-owned',
    type: 'typed-projection',
    createdAt: 'typed-projection',
    updatedAt: 'typed-projection',
    content: 'typed-projection',
    recipients: 'exclude',
    conversation: 'typed-projection',
  },
};
const tables: Record<string, string[]> = {
  account_deletion_write_fence: ['key', 'kind', 'operationId', 'installedAt'],
  conversation: expected.Conversation.columns as unknown as string[],
  message: expected.Message.columns as unknown as string[],
  migrations: ['id', 'timestamp', 'name'],
};
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const safePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(apps|libs|docs)\/[A-Za-z0-9_./-]+$/.test(value) &&
  !value.split('/').includes('..');
const same = (left: string[], right: string[]) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  left.length === right.length &&
  new Set(left).size === left.length &&
  [...left].sort().every((item, index) => item === [...right].sort()[index]);

export const CHAT_ACCOUNT_EXPORT_INVENTORY = inventory;
export function validateChatDispositions(
  raw: readonly any[],
  value: unknown = inventory,
  physical?: Array<{ table: string; columns: string[] }>
): string[] {
  const errors: string[] = [];
  if (
    !Array.isArray(raw) ||
    raw.some(
      (item) =>
        !record(item) ||
        !Array.isArray(item.columns) ||
        !Array.isArray(item.relations)
    ) ||
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.entities) ||
    !Array.isArray(value.stores) ||
    !record(value.selection?.selector)
  )
    return ['invalid inventory shape'];
  const metadata: Metadata[] = raw.map((item: any) => ({
    name: item.name,
    table: item.tableName ?? item.table,
    tableType: item.tableType,
    columns: (item.columns ?? []).map((column: any) => ({
      database: column.databaseName ?? column.database,
    })),
    relations: (item.relations ?? []).map((relation: any) => ({
      property: relation.propertyName ?? relation.property,
    })),
  }));
  const entityNames = Object.keys(expected);
  if (
    !same(
      metadata.map((item) => item.name),
      entityNames
    )
  )
    errors.push('entity metadata drift');
  if (
    value.entities.length !== entityNames.length ||
    !same(
      value.entities
        .map((item: any) => item?.name)
        .filter((name: unknown) => typeof name === 'string'),
      entityNames
    )
  )
    errors.push('entity inventory drift');
  for (const name of entityNames) {
    const schema = expected[name as keyof typeof expected];
    const meta = metadata.find((item) => item.name === name);
    const entity = value.entities.find((item: any) => item?.name === name);
    if (!meta || !entity) continue;
    if (
      meta.table !== schema.table ||
      !same(
        meta.columns.map((column) => column.database),
        [...schema.columns]
      )
    )
      errors.push(`${name} metadata columns drift`);
    if (
      !same(
        meta.relations.map((relation) => relation.property),
        [...schema.relations]
      )
    )
      errors.push(`${name} metadata relations drift`);
    if (
      entity.table !== schema.table ||
      !safePath(entity.source) ||
      !Array.isArray(entity.columns) ||
      !Array.isArray(entity.relations)
    ) {
      errors.push(`${name} inventory metadata malformed`);
      continue;
    }
    const covered: string[] = [];
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
        errors.push(`${name} invalid disposition group`);
        continue;
      }
      covered.push(...group.fields);
      for (const field of group.fields)
        if (fieldActions[name]?.[field] !== group.action)
          errors.push(`${name} disposition action drift: ${field}`);
    }
    if (!same(covered, [...schema.columns, ...schema.relations]))
      errors.push(`${name} disposition coverage drift`);
    const entityFields = entity.columns.flatMap((group: any) =>
      record(group) && Array.isArray(group.fields) ? group.fields : []
    );
    if (
      name === 'Conversation' &&
      !['id', 'type', 'isDeleted', 'createdAt', 'updatedAt'].every((field) =>
        entity.columns.some(
          (group: any) =>
            record(group) &&
            Array.isArray(group.fields) &&
            group.fields.includes(field) &&
            group.action !== 'exclude'
        )
      )
    )
      errors.push('Conversation export allowlist drift');
    if (
      name === 'Message' &&
      ![
        'id',
        'senderId',
        'conversationId',
        'type',
        'createdAt',
        'updatedAt',
        'content',
      ].every((field) =>
        entity.columns.some(
          (group: any) =>
            record(group) &&
            Array.isArray(group.fields) &&
            group.fields.includes(field) &&
            group.action !== 'exclude'
        )
      )
    )
      errors.push('Message export allowlist drift');
    if (
      entityFields.includes('recipients') &&
      entity.columns.some(
        (group: any) =>
          record(group) &&
          Array.isArray(group.fields) &&
          group.fields.includes('recipients') &&
          group.action !== 'exclude'
      )
    )
      errors.push('Message recipients must be excluded');
  }
  const stores = new Set([
    'typeorm_migrations_store',
    'processOutput',
    'configurationInputs',
    'Gateway.connectedClients',
  ]);
  if (
    value.stores.length !== stores.size ||
    value.stores.some(
      (store: any) =>
        !record(store) ||
        !stores.delete(store.name) ||
        !Array.isArray(store.fields) ||
        !store.fields.length ||
        store.action !== 'exclude' ||
        typeof store.handling !== 'string' ||
        typeof store.reason !== 'string' ||
        !Array.isArray(store.evidence) ||
        store.evidence.some((path: unknown) => !safePath(path))
    )
  )
    errors.push('store disposition drift');
  if (stores.size) errors.push('store disposition missing');
  if (
    value.selection.principal !==
      'account-wide-shared-chat-across-current-captured-profiles' ||
    value.selection.selector.profileSource !==
      'capturedCurrentProfileIds from Profile snapshot' ||
    value.selection.selector.orOperator !== true ||
    !same(value.selection.selector.conversationBranches, [
      'participant',
      'owner-profile',
      'sent-message-author',
    ]) ||
    value.selection.selector.accountOwnerOnly !==
      'include candidate and fail capture as CHAT_EXPORT_AMBIGUOUS_ACCOUNT_OWNER' ||
    value.selection.selector.messageSelector !==
      'senderId only; recipients never select messages' ||
    value.selection.selector.statusFilter !== false ||
    value.selection.selector.membershipFilter !== false
  )
    errors.push('selection policy drift');
  if (physical) {
    const actual = physical.map((table) => table.table).sort();
    if (!same(actual, Object.keys(tables)))
      errors.push('physical table catalog drift');
    for (const table of physical)
      if (!tables[table.table] || !same(table.columns, tables[table.table]))
        errors.push(`physical columns drift: ${table.table}`);
    if (
      physical.reduce((count, table) => count + table.columns.length, 0) !== 25
    )
      errors.push('physical column count drift');
  }
  return errors;
}
