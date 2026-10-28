import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import Conversation from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import {
  CHAT_ACCOUNT_EXPORT_INVENTORY,
  validateChatDispositions,
} from './chat-account-export-dispositions';

describe('O04 Chat Collector disposition inventory', () => {
  it('matches built ORM metadata offline and covers every entity field and relation', async () => {
    const source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      database: 'offline_metadata',
      username: 'none',
      password: 'none',
      entities: [Conversation, Message, AccountDeletionWriteFenceEntity],
      synchronize: false,
      migrationsRun: false,
      migrations: [],
    });
    await (source as any).buildMetadatas();
    expect(source.entityMetadatas).toHaveLength(3);
    expect(validateChatDispositions(source.entityMetadatas)).toEqual([]);
    const message = source.entityMetadatas.find(
      (meta) => meta.name === 'Message'
    )!;
    expect(message.columns.map((column) => column.databaseName)).toContain(
      'conversationId'
    );
    expect(
      message.foreignKeys.map((key) => [
        key.onDelete,
        key.referencedEntityMetadata.tableName,
      ])
    ).toContainEqual(['CASCADE', 'conversation']);
  });

  it('rejects duplicate, extra, missing, malformed, and unsafe evidence dispositions', async () => {
    const source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      database: 'offline_metadata',
      username: 'none',
      password: 'none',
      entities: [Conversation, Message, AccountDeletionWriteFenceEntity],
      synchronize: false,
      migrationsRun: false,
      migrations: [],
    });
    await (source as any).buildMetadatas();
    const metadata = source.entityMetadatas;
    const data = JSON.parse(JSON.stringify(CHAT_ACCOUNT_EXPORT_INVENTORY));
    data.entities[0].columns[0].fields.push('id');
    expect(validateChatDispositions(metadata, data)).toContain(
      'Conversation disposition coverage drift'
    );
    const extra = JSON.parse(JSON.stringify(CHAT_ACCOUNT_EXPORT_INVENTORY));
    extra.entities.push(extra.entities[0]);
    expect(validateChatDispositions(metadata, extra)).toContain(
      'entity inventory drift'
    );
    for (const mutate of [
      (x: any) => {
        x.entities.push(null);
      },
      (x: any) => {
        x.entities[0].columns = {};
      },
      (x: any) => {
        x.entities[0].columns[0] = null;
      },
      (x: any) => {
        x.selection.selector.conversationBranches = null;
      },
      (x: any) => {
        x.selection.selector.orOperator = 'OR';
      },
      (x: any) => {
        x.selection.selector.profileSource = 'client-provided';
      },
    ]) {
      const invalid = JSON.parse(JSON.stringify(CHAT_ACCOUNT_EXPORT_INVENTORY));
      mutate(invalid);
      expect(() => validateChatDispositions(metadata, invalid)).not.toThrow();
      expect(
        validateChatDispositions(metadata, invalid).length
      ).toBeGreaterThan(0);
    }
    const malformed = JSON.parse(JSON.stringify(CHAT_ACCOUNT_EXPORT_INVENTORY));
    malformed.entities[1].columns[0].evidence[0] = '../private.ts';
    expect(validateChatDispositions(metadata, malformed)).toContain(
      'Message invalid disposition group'
    );
  });
});
