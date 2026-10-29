import { CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createChatAccountExportSources } from './account-export-sources';

const account = '123e4567-e89b-42d3-a456-426614174000';
const profile = '123e4567-e89b-42d3-a456-426614174001';
const id = '123e4567-e89b-42d3-a456-426614174002';
const stamp = '2025-01-01 01:02:03.123456';

describe('Chat account export sources', () => {
  it('keeps the two-source order and bounded keyset queries', () => {
    const sources = createChatAccountExportSources(
      'chat_collector_export_scope_' + 'a'.repeat(32)
    );
    expect(sources.map((source) => source.source)).toEqual(
      CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    for (const source of sources) {
      expect(source.sql).toContain('LIMIT $3');
      expect(source.sql).toContain('COLLATE "C"');
      expect(source.sql).toContain('$1');
      expect(source.sql).toContain('$2');
    }
    expect(sources[0].sql).toContain('lower(r."ownerId"::text)=$1');
    expect(sources[0].sql).toContain('unnest(r.participants)');
    expect(sources[0].sql).toContain('m."senderId"');
    expect(sources[0].sql).not.toMatch(
      /r\.title|communityId|projectId|participants\s+AS/
    );
    expect(sources[1].sql).toContain('$1::uuid IS NOT NULL');
    expect(sources[1].sql).toContain(
      "CASE WHEN r.type::text='chat' THEN left(r.content,65537) ELSE NULL END"
    );
    expect(sources[1].sql).not.toContain('recipients');
  });

  it('projects minimal conversation context and rejects ambiguous account-only ownership', () => {
    const source = createChatAccountExportSources('profiles')[0];
    const result = source.project(
      {
        id,
        type: 'community',
        isDeleted: false,
        createdAt: stamp,
        updatedAt: stamp,
        recordedParticipation: true,
        recordedStewardship: false,
        hasRecordedSentMessages: true,
      },
      account
    );
    expect(result).toMatchObject({
      id,
      type: 'community',
      recordedParticipation: true,
      hasRecordedSentMessages: true,
      attribution: 'recorded-unverified',
      consent: 'not-inferred',
    });
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('ownerId');
    expect(result).not.toHaveProperty('communityId');
    expect(result.createdAt).toBe('2025-01-01T01:02:03.123456Z');
    expect(() =>
      source.project(
        {
          id,
          type: 'direct',
          isDeleted: false,
          createdAt: stamp,
          updatedAt: stamp,
          recordedParticipation: false,
          recordedStewardship: false,
          hasRecordedSentMessages: false,
        },
        account
      )
    ).toThrow('CHAT_EXPORT_AMBIGUOUS_ACCOUNT_OWNER');
    expect(() =>
      source.project(
        {
          id,
          type: 'direct',
          isDeleted: 'false',
          createdAt: stamp,
          updatedAt: stamp,
          recordedParticipation: true,
          recordedStewardship: false,
          hasRecordedSentMessages: false,
        },
        account
      )
    ).toThrow('CHAT_EXPORT_INVALID_BOOLEAN');
  });

  it('projects sender-only messages, excludes generated content, and fails invalid/orphan/oversized rows', () => {
    const source = createChatAccountExportSources('profiles')[1];
    const chat = source.project(
      {
        id,
        senderId: profile,
        conversationId: account,
        type: 'chat',
        createdAt: stamp,
        updatedAt: stamp,
        parentValid: true,
        content: 'hi 🌱',
      },
      account
    );
    expect(chat.content).toBe('hi 🌱');
    expect(chat.senderId).toBe(profile);
    expect(chat).not.toHaveProperty('recipients');
    const system = source.project(
      {
        id,
        senderId: profile,
        conversationId: account,
        type: 'system',
        createdAt: stamp,
        updatedAt: stamp,
        parentValid: true,
        content: null,
      },
      account
    );
    expect(system).not.toHaveProperty('content');
    expect(system.contentDisposition).toBe(
      'excluded-generated-or-unverified-type'
    );
    expect(() =>
      source.project(
        {
          id,
          senderId: profile,
          conversationId: account,
          type: 'chat',
          createdAt: stamp,
          updatedAt: stamp,
          parentValid: true,
          content: 'x'.repeat(65537),
        },
        account
      )
    ).toThrow('CHAT_EXPORT_INVALID_TEXT');
    expect(() =>
      source.project(
        {
          id,
          senderId: profile,
          conversationId: account,
          type: 'chat',
          createdAt: stamp,
          updatedAt: stamp,
          parentValid: false,
          content: '',
        },
        account
      )
    ).toThrow('CHAT_EXPORT_ORPHAN_MESSAGE');
    expect(() =>
      source.project(
        {
          id,
          senderId: 'bad',
          conversationId: account,
          type: 'chat',
          createdAt: stamp,
          updatedAt: stamp,
          parentValid: true,
          content: '',
        },
        account
      )
    ).toThrow('CHAT_EXPORT_INVALID_ID');
  });

  it('rejects unsafe profile identifiers', () => {
    expect(() => createChatAccountExportSources('profiles;DROP')).toThrow(
      'CHAT_EXPORT_INVALID_PROFILE_TABLE'
    );
  });
});
