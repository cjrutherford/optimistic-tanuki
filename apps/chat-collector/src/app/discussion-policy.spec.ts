import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AppService } from './app.service';
import { ConversationType } from './entities';

describe('Discussion authorization', () => {
  const room = {
    id: 'room',
    type: ConversationType.PROJECT,
    projectId: 'project',
    participants: ['owner', 'former'],
    messages: [],
  };
  let messages: any;
  let rooms: any;
  let social: any;
  let projects: any;
  let service: AppService;
  beforeEach(() => {
    messages = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data, id: data.id ?? 'm1' })),
      save: jest.fn(async (data) => data),
    };
    rooms = {
      findOne: jest.fn().mockResolvedValue({ ...room }),
      find: jest.fn().mockResolvedValue([{ ...room }]),
      save: jest.fn(async (data) => data),
      update: jest.fn(async () => ({
        affected: 1,
        raw: [],
        generatedMaps: [],
      })),
    };
    social = { send: jest.fn(() => of(false)) };
    projects = { send: jest.fn(() => of({ owner: 'owner', members: [] })) };
    service = new (AppService as any)(
      { log: jest.fn(), debug: jest.fn() } as unknown as Logger,
      messages,
      rooms,
      social,
      projects
    );
  });
  it('does not keep a removed project member authorized through the saved participant snapshot', async () => {
    await expect(service.getMessages('room', 'former')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 403 }),
    });
    expect(messages.find).not.toHaveBeenCalled();
  });
  it('preserves an owning-service access refusal across the collector RPC boundary', async () => {
    projects.send.mockReturnValue(
      throwError(() => ({ statusCode: 403, message: 'Project access denied' }))
    );
    await expect(service.getMessages('room', 'former')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 403 }),
    });
    expect(messages.find).not.toHaveBeenCalled();
  });
  it('omits a revoked project from the list while preserving access to other conversations', async () => {
    rooms.find.mockResolvedValue([
      room,
      {
        ...room,
        id: 'direct',
        type: ConversationType.DIRECT,
        participants: ['former', 'peer'],
      },
    ]);
    social.send.mockReturnValue(of([]));
    projects.send.mockReturnValue(
      throwError(() => ({ statusCode: 403, message: 'Project access denied' }))
    );
    await expect(service.getConversations('former')).resolves.toEqual([
      expect.objectContaining({ id: 'direct' }),
    ]);
  });
  it('keeps the current project owner authorized', async () => {
    await expect(service.getMessages('room', 'owner')).resolves.toEqual([]);
  });
  it('uses current approved membership instead of stale community participants', async () => {
    rooms.findOne.mockResolvedValue({
      ...room,
      type: ConversationType.COMMUNITY,
      communityId: 'community',
    });
    social.send.mockReturnValue(
      of([
        { profileId: 'owner', status: 'approved' },
        { profileId: 'former', status: 'revoked' },
      ])
    );
    await expect(service.getMessages('room', 'owner')).resolves.toEqual([]);
    await expect(service.getMessages('room', 'former')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 403 }),
    });
  });
  it('stores a repeated authorized message ID only once', async () => {
    rooms.findOne.mockResolvedValue({
      ...room,
      type: ConversationType.DIRECT,
      participants: ['owner', 'peer'],
    });
    const sent = {
      id: 'stable-id',
      conversationId: 'room',
      senderId: 'owner',
      recipientIds: ['attacker'],
      content: 'durable',
      type: 'chat',
    } as any;
    messages.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'stable-id',
      senderId: 'owner',
      content: 'durable',
      conversation: { id: 'room' },
    });
    await service.postMessage(sent);
    await service.postMessage(sent);
    expect(messages.save).toHaveBeenCalledTimes(1);
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: ['peer'] })
    );
  });
  it('checks reciprocal block state before both REST and legacy socket writes', async () => {
    rooms.findOne.mockResolvedValue({
      ...room,
      type: ConversationType.DIRECT,
      participants: ['owner', 'peer'],
    });
    social.send.mockImplementation((_, data) => of(data.blockerId === 'peer'));
    await expect(
      service.postMessageHttp({
        conversationId: 'room',
        senderId: 'owner',
        recipientIds: ['peer'],
        content: 'blocked',
      })
    ).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 403 }),
    });
    await expect(
      service.postMessage({
        conversationId: 'room',
        senderId: 'owner',
        recipientIds: ['peer'],
        content: 'blocked',
        type: 'chat',
      } as any)
    ).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 403 }),
    });
    expect(messages.save).not.toHaveBeenCalled();
  });
});
