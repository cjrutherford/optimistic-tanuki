import { AppService as ChatService } from '../../../chat-collector/src/app/app.service';
import {
  Conversation,
  Message,
} from '../../../chat-collector/src/app/entities';
import { randomUUID } from 'node:crypto';
import { DELETED_ACCOUNT_ID as nil } from '@optimistic-tanuki/models';
import { ChatCommands } from '@optimistic-tanuki/chat-contracts';
import loadDatabase from '../../../chat-collector/src/app/loadDatabase';
import { ChatAccountDeletionOwnerService } from '../../../chat-collector/src/app/account-deletion-owner.service';
import { ChatAccountDeletionOwnerController } from '../../../chat-collector/src/app/account-deletion-owner.controller';
import { DeletionOwnerFixture } from './deletion-owner.fixture';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
(process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture'
  ? describe
  : describe.skip)('D11 real Auth/Chat TCP deletion', () => {
  const f = new DeletionOwnerFixture();
  let client: any;
  let c: string, own: string, foreign: string;
  beforeAll(async () => {
    const authority = await f.start(
      'd11_chat',
      loadDatabase({ get: () => ({}) } as never)
    );
    const service = new ChatAccountDeletionOwnerService(f.db, authority);
    client = await f.serve(
      [ChatAccountDeletionOwnerController],
      [{ provide: ChatAccountDeletionOwnerService, useValue: service }]
    );
    c = await f.seed('conversation', {
      id: randomUUID(),
      title: 'PRIVATE_DIRECT_TITLE',
      ownerId: f.profile,
      participants: [f.profile, f.otherProfile],
    });
    own = await f.seed('message', {
      id: randomUUID(),
      senderId: f.profile,
      content: 'PRIVATE_SENT_BODY',
      recipients: [f.otherProfile],
      conversationId: c,
    });
    foreign = await f.seed('message', {
      id: randomUUID(),
      senderId: f.otherProfile,
      content: 'COUNTERPART_BODY',
      recipients: [f.profile],
      conversationId: c,
    });
  }, 30000);
  afterAll(() => f.close(), 30000);
  it('drains a writer, rejects old/new identity restoration, rolls back/retries and retains counterpart content', async () => {
    await expect(
      f.call(
        client,
        ChatCommands.FENCE_ACCOUNT_DELETION,
        await f.grant('workspace', 'fence')
      )
    ).rejects.toBeTruthy();
    const grant = await f.grant('chat-collector', 'fence');
    const writer = f.db.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    await writer.query('UPDATE message SET content=content WHERE id=$1', [own]);
    let done = false;
    const pending = f
      .call(client, ChatCommands.FENCE_ACCOUNT_DELETION, grant)
      .then((r) => {
        done = true;
        return r;
      });
    try {
      await new Promise((r) => setTimeout(r, 120));
      expect(done).toBe(false);
      await writer.commitTransaction();
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
    }
    expect(await pending).toMatchObject({ verified: true });
    await f.authority.acknowledge(grant);
    await expect(
      f.db.query('UPDATE message SET "senderId"=$2 WHERE id=$1', [
        own,
        f.otherProfile,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      f.db.query('UPDATE message SET "senderId"=$2 WHERE id=$1', [
        foreign,
        f.profile,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await f.allFencePremises();
    const erase = await f.grant('chat-collector', 'erase');
    await f.db.query(
      "CREATE FUNCTION d11_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D11_INJECTED';END $$"
    );
    await f.db.query(
      'CREATE TRIGGER d11_fault AFTER DELETE ON message FOR EACH ROW EXECUTE FUNCTION d11_fault()'
    );
    await expect(
      f.call(client, ChatCommands.ERASE_ACCOUNT_DELETION, erase)
    ).rejects.toBeTruthy();
    expect(
      (await f.db.query('SELECT id FROM message WHERE id=$1', [own])).length
    ).toBe(1);
    await f.db.query('DROP TRIGGER d11_fault ON message');
    await f.db.query('DROP FUNCTION d11_fault()');
    expect(
      await f.call(client, ChatCommands.ERASE_ACCOUNT_DELETION, erase)
    ).toEqual({ verified: true, remaining: 0 });
    expect(
      await f.call(client, ChatCommands.ERASE_ACCOUNT_DELETION, erase)
    ).toEqual({ verified: true, remaining: 0 });
    await f.authority.acknowledge(erase);
    expect(
      await f.call(
        client,
        ChatCommands.READBACK_ACCOUNT_DELETION,
        await f.grant('chat-collector', 'readback')
      )
    ).toEqual({ verified: true, remaining: 0 });
    const row = (
      await f.db.query('SELECT * FROM message WHERE id=$1', [foreign])
    )[0];
    expect(row.content).toBe('COUNTERPART_BODY');
    expect(row.senderId).toBe(f.otherProfile);
    expect(row.recipients).toEqual([nil]);
    const conv = (
      await f.db.query('SELECT * FROM conversation WHERE id=$1', [c])
    )[0];
    expect(conv.ownerId).toBe(nil);
    expect(conv.participants.sort()).toEqual([nil, f.otherProfile].sort());
    expect(conv.title).toBe('Deleted account conversation');
    expect(
      await f.db.query('SELECT id FROM message WHERE id=$1', [own])
    ).toEqual([]);
    await expect(
      f.seed('message', {
        id: randomUUID(),
        content: 'STALE',
        senderId: f.profile,
        recipients: [f.otherProfile],
        conversationId: c,
      })
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await f.seed('message', {
      id: randomUUID(),
      content: 'COUNTERPART_NEW',
      senderId: f.otherProfile,
      recipients: [nil],
      conversationId: c,
    });
    const service = new ChatService(
      { log: () => {} } as never,
      f.db.getRepository(Message),
      f.db.getRepository(Conversation),
      {
        send: () => {
          throw Error('UNEXPECTED_SOCIAL_RPC');
        },
      } as never,
      {
        send: () => {
          throw Error('UNEXPECTED_PROJECT_RPC');
        },
      } as never
    );
    const visible = await service.getMessages(c, f.otherProfile);
    expect(visible.map((m) => m.content).sort()).toEqual([
      'COUNTERPART_BODY',
      'COUNTERPART_NEW',
    ]);
    await expect(service.getMessages(c, f.profile)).rejects.toBeTruthy();
  }, 30000);
});
