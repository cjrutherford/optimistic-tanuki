import { expect, test } from '@playwright/test';
import {
  assertDirectConversationFixtureSafe,
  createLocalChatCleanupPool,
  DirectConversationCleanupInput,
} from '../../../tools/testing/rr10-direct-chat-cleanup';

const conversationId = '11111111-1111-4111-8111-111111111111';
const aliceId = '22222222-2222-4222-8222-222222222222';
const bobId = '33333333-3333-4333-8333-333333333333';
const outsiderId = '44444444-4444-4444-8444-444444444444';
const startedAt = new Date('2026-10-12T12:00:00.000Z');
const finishedAt = new Date('2026-10-12T12:10:00.000Z');

function fixture(): DirectConversationCleanupInput {
  return {
    conversationId,
    controlledProfileIds: [aliceId, bobId],
    startedAt,
    finishedAt,
    conversation: {
      id: conversationId,
      type: 'direct',
      ownerId: null,
      communityId: null,
      projectId: null,
      isDeleted: false,
      createdAt: new Date('2026-10-12T12:02:00.000Z'),
      participants: [aliceId, bobId],
    },
    messages: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        content: 'private fixture body',
        senderId: aliceId,
        type: 'chat',
        recipients: [bobId],
        createdAt: new Date('2026-10-12T12:03:00.000Z'),
        updatedAt: new Date('2026-10-12T12:03:00.000Z'),
      },
    ],
  };
}

test('RR10-I03 cleanup guard accepts only a fresh exact direct fixture', () => {
  expect(() => assertDirectConversationFixtureSafe(fixture())).not.toThrow();
});

test('RR10-I03 cleanup guard refuses a pre-existing conversation', () => {
  const input = fixture();
  input.conversation.createdAt = new Date('2026-10-12T11:59:59.999Z');
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'outside the bounded test time window'
  );
});

test('RR10-I03 cleanup guard refuses a different participant pair', () => {
  const input = fixture();
  input.conversation.participants = [aliceId, outsiderId];
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'participants do not match the exact fixture'
  );
});

test('RR10-I03 cleanup guard refuses duplicate controlled identities', () => {
  const input = fixture();
  input.controlledProfileIds = [aliceId, aliceId];
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'Exactly two controlled profile UUIDs are required'
  );
});

test('RR10-I03 cleanup guard refuses a reversed time window', () => {
  const input = fixture();
  input.startedAt = finishedAt;
  input.finishedAt = startedAt;
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'outside the bounded test time window'
  );
});

test('RR10-I03 cleanup UTC window comparison is stable across session zones', async () => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the isolated RR10 PostgreSQL fixture database'
  );
  const pool = createLocalChatCleanupPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'America/New_York'");
    const result = await client.query<{
      implicitWindowMatch: boolean;
      utcWindowMatch: boolean;
    }>(
      `SELECT
         (TIMESTAMP '2026-10-12 10:00:00' BETWEEN $1 AND $2)
           AS "implicitWindowMatch",
         ((TIMESTAMP '2026-10-12 10:00:00' AT TIME ZONE 'UTC')
           BETWEEN $1::timestamptz AND $2::timestamptz)
           AS "utcWindowMatch"`,
      [
        new Date('2026-10-12T09:30:00.000Z'),
        new Date('2026-10-12T10:30:00.000Z'),
      ]
    );
    expect(result.rows[0]).toEqual({
      implicitWindowMatch: false,
      utcWindowMatch: true,
    });
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
});

test('RR10-I03 cleanup guard refuses any uncontrolled sender or recipient', () => {
  const input = fixture();
  input.messages[0].senderId = outsiderId;
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'uncontrolled sender'
  );

  input.messages[0].senderId = aliceId;
  input.messages[0].recipients = [outsiderId];
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'uncontrolled recipient'
  );
});

test('RR10-I03 cleanup guard refuses system messages and non-direct rows', () => {
  const input = fixture();
  input.messages[0].type = 'system';
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'unexpected system message'
  );

  input.messages[0].type = 'chat';
  input.conversation.type = 'community';
  expect(() => assertDirectConversationFixtureSafe(input)).toThrow(
    'deletion state is unexpected'
  );
});

test('RR10-I03 cleanup pool requires an explicit database port', () => {
  const originalPassword = process.env['RR10_I03_CHAT_DB_PASSWORD'];
  const originalPort = process.env['RR10_I03_CHAT_DB_PORT'];
  process.env['RR10_I03_CHAT_DB_PASSWORD'] = 'test-only';
  delete process.env['RR10_I03_CHAT_DB_PORT'];

  try {
    expect(() => createLocalChatCleanupPool()).toThrow(
      'RR10_I03_CHAT_DB_PORT is required'
    );
  } finally {
    if (originalPassword === undefined) delete process.env['RR10_I03_CHAT_DB_PASSWORD'];
    else process.env['RR10_I03_CHAT_DB_PASSWORD'] = originalPassword;
    if (originalPort === undefined) delete process.env['RR10_I03_CHAT_DB_PORT'];
    else process.env['RR10_I03_CHAT_DB_PORT'] = originalPort;
  }
});

test('RR10-I03 cleanup pool uses the explicitly configured isolated port', async () => {
  const originalPassword = process.env['RR10_I03_CHAT_DB_PASSWORD'];
  const originalPort = process.env['RR10_I03_CHAT_DB_PORT'];
  process.env['RR10_I03_CHAT_DB_PASSWORD'] = 'test-only';
  process.env['RR10_I03_CHAT_DB_PORT'] = '15432';
  const pool = createLocalChatCleanupPool();

  try {
    expect(pool.options.port).toBe(15432);
  } finally {
    await pool.end();
    if (originalPassword === undefined) delete process.env['RR10_I03_CHAT_DB_PASSWORD'];
    else process.env['RR10_I03_CHAT_DB_PASSWORD'] = originalPassword;
    if (originalPort === undefined) delete process.env['RR10_I03_CHAT_DB_PORT'];
    else process.env['RR10_I03_CHAT_DB_PORT'] = originalPort;
  }
});

test('RR10-I03 cleanup pool refuses canonical port without an explicit opt-in', () => {
  const originalPassword = process.env['RR10_I03_CHAT_DB_PASSWORD'];
  const originalPort = process.env['RR10_I03_CHAT_DB_PORT'];
  const originalOptIn = process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'];
  process.env['RR10_I03_CHAT_DB_PASSWORD'] = 'test-only';
  process.env['RR10_I03_CHAT_DB_PORT'] = '5432';
  delete process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'];

  try {
    expect(() => createLocalChatCleanupPool()).toThrow(
      '5432 requires RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT=true'
    );
  } finally {
    if (originalPassword === undefined) delete process.env['RR10_I03_CHAT_DB_PASSWORD'];
    else process.env['RR10_I03_CHAT_DB_PASSWORD'] = originalPassword;
    if (originalPort === undefined) delete process.env['RR10_I03_CHAT_DB_PORT'];
    else process.env['RR10_I03_CHAT_DB_PORT'] = originalPort;
    if (originalOptIn === undefined) delete process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'];
    else process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'] = originalOptIn;
  }
});

test('RR10-I03 cleanup pool allows canonical port only after explicit opt-in', async () => {
  const originalPassword = process.env['RR10_I03_CHAT_DB_PASSWORD'];
  const originalPort = process.env['RR10_I03_CHAT_DB_PORT'];
  const originalOptIn = process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'];
  process.env['RR10_I03_CHAT_DB_PASSWORD'] = 'test-only';
  process.env['RR10_I03_CHAT_DB_PORT'] = '5432';
  process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'] = 'true';
  const pool = createLocalChatCleanupPool();

  try {
    expect(pool.options.port).toBe(5432);
  } finally {
    await pool.end();
    if (originalPassword === undefined) delete process.env['RR10_I03_CHAT_DB_PASSWORD'];
    else process.env['RR10_I03_CHAT_DB_PASSWORD'] = originalPassword;
    if (originalPort === undefined) delete process.env['RR10_I03_CHAT_DB_PORT'];
    else process.env['RR10_I03_CHAT_DB_PORT'] = originalPort;
    if (originalOptIn === undefined) delete process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'];
    else process.env['RR10_I03_CHAT_DB_ALLOW_CANONICAL_PORT'] = originalOptIn;
  }
});
