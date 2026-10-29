import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Pool, PoolClient } from 'pg';

export interface DirectConversationRow {
  id: string;
  type: string;
  ownerId: string | null;
  communityId: string | null;
  projectId: string | null;
  isDeleted: boolean;
  createdAt: string | Date;
  participants: string[];
}

export interface DirectMessageRow {
  id: string;
  content: string;
  senderId: string;
  type: string;
  recipients: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DirectConversationCleanupInput {
  conversation: DirectConversationRow;
  messages: DirectMessageRow[];
  conversationId: string;
  controlledProfileIds: string[];
  startedAt: Date;
  finishedAt: Date;
}

export interface DirectConversationCleanupReceipt {
  conversationId: string;
  databaseTimeZone: string;
  participantCount: number;
  retainedMessageCount: number;
  retainedMessageSha256: string;
  softDeleted: true;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string): void {
  if (!uuidPattern.test(value)) throw new Error(`${label} must be a UUID`);
}

function normalizedTime(value: string | Date): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Fixture timestamp is invalid');
  return time;
}

export function assertDirectConversationFixtureSafe(
  input: DirectConversationCleanupInput,
  expectedDeleted = false
): void {
  const { conversation, messages, conversationId, controlledProfileIds } =
    input;
  requireUuid(conversationId, 'conversationId');
  if (conversation.id !== conversationId)
    throw new Error('Conversation id does not match the exact target');
  if (
    conversation.type !== 'direct' ||
    conversation.isDeleted !== expectedDeleted
  )
    throw new Error('Target direct conversation deletion state is unexpected');
  if (
    conversation.ownerId !== null ||
    conversation.communityId !== null ||
    conversation.projectId !== null
  )
    throw new Error('Target contains non-direct ownership or scope data');

  const expected = [...new Set(controlledProfileIds)].sort();
  if (
    controlledProfileIds.length !== 2 ||
    expected.length !== 2 ||
    expected.some((profileId) => !uuidPattern.test(profileId))
  )
    throw new Error('Exactly two controlled profile UUIDs are required');
  const participants = [...conversation.participants].sort();
  if (
    participants.length !== expected.length ||
    participants.some((profileId, index) => profileId !== expected[index])
  )
    throw new Error('Conversation participants do not match the exact fixture');

  const createdAt = normalizedTime(conversation.createdAt);
  const startedAt = input.startedAt.getTime();
  const finishedAt = input.finishedAt.getTime();
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(finishedAt) ||
    startedAt > finishedAt ||
    createdAt < startedAt ||
    createdAt > finishedAt
  )
    throw new Error('Conversation is outside the bounded test time window');

  const participantSet = new Set(expected);
  for (const message of messages) {
    const messageCreatedAt = normalizedTime(message.createdAt);
    if (messageCreatedAt < startedAt || messageCreatedAt > finishedAt)
      throw new Error('Message is outside the bounded test time window');
    if (!participantSet.has(message.senderId))
      throw new Error(
        'Conversation contains a message from an uncontrolled sender'
      );
    if (message.type === 'system')
      throw new Error('Conversation contains an unexpected system message');
    if (message.recipients.some((recipient) => !participantSet.has(recipient)))
      throw new Error('Conversation contains an uncontrolled recipient');
  }
}

function messageDigest(messages: DirectMessageRow[]): string {
  const canonical = [...messages]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((message) => ({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      type: message.type,
      recipients: [...message.recipients].sort(),
      createdAt: new Date(message.createdAt).toISOString(),
      updatedAt: new Date(message.updatedAt).toISOString(),
    }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function readExactRows(
  client: PoolClient,
  conversationId: string
): Promise<{
  conversation: DirectConversationRow | undefined;
  messages: DirectMessageRow[];
}> {
  const conversationResult = await client.query<DirectConversationRow>(
    `SELECT id, type, "ownerId", "communityId", "projectId", "isDeleted",
            "createdAt" AT TIME ZONE 'UTC' AS "createdAt", participants
       FROM "conversation"
      WHERE id = $1
      FOR UPDATE`,
    [conversationId]
  );
  const messageResult = await client.query<DirectMessageRow>(
    `SELECT id, content, "senderId", type, recipients,
            "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
            "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"
       FROM "message"
      WHERE "conversationId" = $1
      ORDER BY id
      FOR UPDATE`,
    [conversationId]
  );
  return {
    conversation: conversationResult.rows[0],
    messages: messageResult.rows,
  };
}

export async function softDeleteExactDirectConversation(
  pool: Pool,
  input: Omit<DirectConversationCleanupInput, 'conversation' | 'messages'>
): Promise<DirectConversationCleanupReceipt> {
  if (process.env['RR10_I03_LIVE_STACK'] !== 'true')
    throw new Error(
      'Direct conversation cleanup requires RR10_I03_LIVE_STACK=true'
    );
  if (pool.options.host !== '127.0.0.1' && pool.options.host !== 'localhost')
    throw new Error(
      'Direct conversation cleanup is restricted to local PostgreSQL'
    );
  if (pool.options.database !== 'ot_chat_collector')
    throw new Error(
      'Direct conversation cleanup is restricted to ot_chat_collector'
    );

  const client = await pool.connect();
  try {
    const timeZoneResult = await client.query<{ TimeZone: string }>(
      'SHOW TIME ZONE'
    );
    const databaseTimeZone = timeZoneResult.rows[0]?.TimeZone;
    if (
      !databaseTimeZone ||
      !['UTC', 'Etc/UTC', 'GMT'].includes(databaseTimeZone)
    )
      throw new Error('Chat database session timezone is not UTC');
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // The exact conversation FOR UPDATE lock conflicts with the FK key-share
    // lock taken by message inserts. Existing exact messages are also locked;
    // unrelated conversations remain writable.
    const before = await readExactRows(client, input.conversationId);
    if (!before.conversation)
      throw new Error('Exact direct conversation fixture was not found');
    assertDirectConversationFixtureSafe({ ...input, ...before });
    const digestBefore = messageDigest(before.messages);
    const update = await client.query(
      `UPDATE "conversation"
          SET "isDeleted" = true
        WHERE id = $1
          AND type = 'direct'
          AND "isDeleted" = false
          AND "ownerId" IS NULL
          AND "communityId" IS NULL
          AND "projectId" IS NULL
          AND ("createdAt" AT TIME ZONE 'UTC')
                BETWEEN $2::timestamptz AND $3::timestamptz
          AND participants @> $4::text[]
          AND participants <@ $4::text[]`,
      [
        input.conversationId,
        input.startedAt,
        input.finishedAt,
        [...input.controlledProfileIds].sort(),
      ]
    );
    if (update.rowCount !== 1)
      throw new Error(
        'Exact direct conversation soft-delete affected no single row'
      );

    const after = await readExactRows(client, input.conversationId);
    if (!after.conversation?.isDeleted)
      throw new Error('Exact direct conversation soft-delete readback failed');
    assertDirectConversationFixtureSafe({ ...input, ...after }, true);
    const digestAfter = messageDigest(after.messages);
    if (
      before.messages.length !== after.messages.length ||
      digestBefore !== digestAfter
    )
      throw new Error('Message count or digest changed during soft-delete');
    await client.query('COMMIT');
    return {
      conversationId: input.conversationId,
      databaseTimeZone,
      participantCount: before.conversation.participants.length,
      retainedMessageCount: after.messages.length,
      retainedMessageSha256: digestAfter,
      softDeleted: true,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function readDeletedDirectMessageRetention(
  pool: Pool,
  conversationId: string
): Promise<{ retainedMessageCount: number; retainedMessageSha256: string }> {
  requireUuid(conversationId, 'conversationId');
  const conversationResult = await pool.query<{ isDeleted: boolean }>(
    `SELECT "isDeleted" FROM "conversation" WHERE id = $1`,
    [conversationId]
  );
  if (
    conversationResult.rows.length !== 1 ||
    !conversationResult.rows[0].isDeleted
  )
    throw new Error('Exact direct conversation is not soft-deleted');
  const messageResult = await pool.query<DirectMessageRow>(
    `SELECT id, content, "senderId", type, recipients,
            "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
            "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"
       FROM "message"
      WHERE "conversationId" = $1
      ORDER BY id`,
    [conversationId]
  );
  return {
    retainedMessageCount: messageResult.rows.length,
    retainedMessageSha256: messageDigest(messageResult.rows),
  };
}

export async function timedAwaitedStage<T>(
  label: string,
  action: () => Promise<T>,
  log: (record: {
    stage: string;
    durationMs: number;
    outcome: 'pass' | 'fail';
  }) => void = (record) =>
    console.info('[RR10-I03 stage]', JSON.stringify(record))
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    log({
      stage: label,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: 'pass',
    });
    return result;
  } catch (error) {
    log({
      stage: label,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: 'fail',
    });
    throw error;
  }
}

export function createLocalChatCleanupPool(): Pool {
  const password = process.env['RR10_I03_CHAT_DB_PASSWORD'];
  if (!password)
    throw new Error(
      'RR10_I03_CHAT_DB_PASSWORD is required for exact fixture cleanup'
    );
  const requestedPort = process.env['RR10_I03_CHAT_DB_PORT'];
  if (!requestedPort)
    throw new Error(
      'RR10_I03_CHAT_DB_PORT is required for exact fixture cleanup'
    );
  const port = Number(requestedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(
      'RR10_I03_CHAT_DB_PORT must be an integer between 1 and 65535'
    );
  if (
    port === 5432 &&
    process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'] !== 'true'
  )
    throw new Error('5432 requires RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT=true');
  return new Pool({
    host: '127.0.0.1',
    port,
    user: process.env['RR10_I03_CHAT_DB_USER'] ?? 'postgres',
    password,
    database: 'ot_chat_collector',
    max: 1,
    connectionTimeoutMillis: 3000,
    application_name: 'rr10-i03-exact-fixture-cleanup',
  });
}
