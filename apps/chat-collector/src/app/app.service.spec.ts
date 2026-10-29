import { ServiceTokens, CommunityCommands } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Conversation,
  ConversationType,
  Message,
  MessageType,
} from './entities';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ChatMessage } from '@optimistic-tanuki/models';
import { Logger } from '@nestjs/common';

// Mock uuidv4
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('AppService', () => {
  let service: AppService;
  let messageRepository: Repository<Message>;
  let conversationRepository: Repository<Conversation>;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: {
            send: jest.fn(({ cmd }) =>
              of(cmd === CommunityCommands.GET_CHAT_MEMBERSHIPS ? [] : false)
            ),
          },
        },
        {
          provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
          useValue: {
            send: jest.fn(() => of({ owner: 'member-profile', members: [] })),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Conversation),
          useClass: Repository,
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message)
    );
    conversationRepository = module.get<Repository<Conversation>>(
      getRepositoryToken(Conversation)
    );
    logger = module.get<Logger>(Logger);

    jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);
    // Mock repository methods
    jest
      .spyOn(messageRepository, 'create')
      .mockImplementation((entity) => entity as Message);
    jest
      .spyOn(messageRepository, 'save')
      .mockImplementation(async (entity) => entity as Message);
    jest
      .spyOn(conversationRepository, 'create')
      .mockImplementation((entity) =>
        Object.assign(new Conversation(), entity)
      );
    jest
      .spyOn(conversationRepository, 'save')
      .mockImplementation(async (entity) => entity as Conversation);
    jest.spyOn(conversationRepository, 'update').mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
  });

  describe('postMessage', () => {
    const mockChatMessage: ChatMessage = {
      id: 'test-message-id',
      conversationId: 'test-conversation-id',
      senderId: 'user1',
      senderName: 'User One',
      recipientId: ['user2'],
      recipientName: ['User Two'],
      content: 'Hello',
      timestamp: new Date(),
      type: MessageType.CHAT,
      role: 'user',
    };

    it('refuses implicit conversation creation without an authorized existing room', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);
      await expect(service.postMessage(mockChatMessage)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('should update an existing conversation', async () => {
      const existingConversation = new Conversation();
      existingConversation.id = 'existing-conv-id';
      existingConversation.messages = [];
      existingConversation.participants = ['user1', 'user2'];
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(existingConversation);

      const chatMessageWithConvId = {
        ...mockChatMessage,
        conversationId: 'existing-conv-id',
      };
      const result = await service.postMessage(chatMessageWithConvId);

      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation: existingConversation,
        })
      );
      expect(messageRepository.save).toHaveBeenCalled();
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(conversationRepository.update).toHaveBeenCalledWith(
        'existing-conv-id',
        { updatedAt: expect.any(Date) }
      );
      expect(conversationRepository.save).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Conversation);
    });

    it('keeps concurrent message writes on the owning relation without saving stale history', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'concurrent-conversation',
        participants: ['user1', 'user2'],
        messages: [],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      const update = jest
        .spyOn(conversationRepository, 'update')
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await Promise.all(
        Array.from({ length: 60 }, (_, index) =>
          service.postMessage({
            ...mockChatMessage,
            id: `concurrent-message-${index}`,
            conversationId: conversation.id,
            content: `Concurrent message ${index}`,
          })
        )
      );

      expect(messageRepository.save).toHaveBeenCalledTimes(60);
      for (const [message] of (messageRepository.create as jest.Mock).mock
        .calls) {
        expect(message.conversation).toBe(conversation);
      }
      expect(update).toHaveBeenCalledTimes(60);
      expect(conversationRepository.save).not.toHaveBeenCalled();
    });

    it('treats a concurrent same-id/same-content insert as an idempotent retry', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'existing-conv-id',
        participants: ['user1', 'user2'],
        messages: [],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(messageRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          Object.assign(new Message(), {
            id: mockChatMessage.id,
            senderId: mockChatMessage.senderId,
            content: mockChatMessage.content,
            conversation,
          })
        );
      jest
        .spyOn(messageRepository, 'save')
        .mockRejectedValueOnce({ code: '23505' });

      await expect(
        service.postMessage({
          ...mockChatMessage,
          conversationId: conversation.id,
        })
      ).resolves.toBe(conversation);

      expect(messageRepository.findOne).toHaveBeenCalledTimes(2);
      expect(conversationRepository.update).not.toHaveBeenCalled();
    });

    it('returns the durable message in the conversation receipt for a sequential same-id retry', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'existing-conv-id',
        participants: ['user1', 'user2'],
        messages: [],
      });
      const durableMessage = Object.assign(new Message(), {
        id: mockChatMessage.id,
        senderId: mockChatMessage.senderId,
        content: mockChatMessage.content,
        conversation,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest
        .spyOn(messageRepository, 'findOne')
        .mockResolvedValue(durableMessage);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([durableMessage]);

      const result = await service.postMessage({
        ...mockChatMessage,
        conversationId: conversation.id,
      });

      expect(result).toBe(conversation);
      expect(result.messages).toEqual([durableMessage]);
      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { conversation: { id: conversation.id } },
        order: { createdAt: 'ASC' },
      });
      expect(messageRepository.save).not.toHaveBeenCalled();
      expect(conversationRepository.update).not.toHaveBeenCalled();
    });

    it('checks current community membership before accepting a duplicate ID', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'community-conversation',
        type: ConversationType.COMMUNITY,
        communityId: 'community-id',
        participants: [],
        messages: [],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(service as any, 'participants').mockResolvedValue([]);

      await expect(
        service.postMessage({
          ...mockChatMessage,
          conversationId: conversation.id,
        })
      ).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });

      expect(messageRepository.findOne).not.toHaveBeenCalled();
      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a sequential same-ID retry when the stored payload differs', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'existing-conv-id',
        participants: ['user1', 'user2'],
        messages: [],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(
        Object.assign(new Message(), {
          id: mockChatMessage.id,
          senderId: mockChatMessage.senderId,
          content: 'Different content',
          conversation,
        })
      );

      await expect(
        service.postMessage({
          ...mockChatMessage,
          conversationId: conversation.id,
        })
      ).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 409 }),
      });

      expect(messageRepository.find).not.toHaveBeenCalled();
      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('does not create a conversation after a repository failure', async () => {
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockRejectedValue(new Error('db error'));
      await expect(service.postMessage(mockChatMessage)).rejects.toThrow(
        'db error'
      );
      expect(conversationRepository.create).not.toHaveBeenCalled();
    });

    it('omits the message id when the payload has no id', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(
        Object.assign(new Conversation(), {
          id: 'test-conversation-id',
          participants: ['user1', 'user2'],
        })
      );
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      const { id, ...rest } = mockChatMessage;
      void id;

      await service.postMessage(rest as any);

      const createdArg = (messageRepository.create as jest.Mock).mock
        .calls[0][0];
      expect(createdArg.id).toBeUndefined();
    });
  });

  /**
   * The conversation belonging to a project.
   *
   * Participants are written on every call rather than kept in step by events.
   * A conversation that drifts out of step with membership is one somebody can
   * still read after they were taken out of the project.
   */
  /**
   * Who may read and write a conversation.
   *
   * This used to answer a conversation id with everything in it, and accept a
   * message from anybody who had one. Proved against the running stack: an
   * account that had left a project read the owner's message and posted a
   * reply. The participant list was only ever used to decide delivery.
   */
  describe('who may read a conversation', () => {
    const IN = 'member-profile';
    const OUT = 'stranger-profile';

    function conversationWith(participants: string[]) {
      const conversation = Object.assign(new Conversation(), {
        id: 'c1',
        type: ConversationType.PROJECT,
        projectId: 'p1',
        participants,
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);
      return conversation;
    }

    it('gives the history to somebody in it', async () => {
      conversationWith([IN]);

      await expect(service.getMessages('c1', IN)).resolves.toEqual([]);
    });

    it('refuses somebody who is not in it', async () => {
      conversationWith([IN]);

      await expect(service.getMessages('c1', OUT)).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
    });

    it('refuses in the same words when the conversation is not there', async () => {
      // Otherwise an id can be tried until the wording changes.
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getMessages('nope', OUT)).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
    });

    it('stays unscoped for a trusted internal call', async () => {
      // Matches how the rest of this workspace scopes: every externally
      // reachable route supplies an identity, and an absent one is internal.
      conversationWith([IN]);

      await expect(service.getMessages('c1')).resolves.toEqual([]);
    });

    it('refuses a message from somebody who is not in it', async () => {
      conversationWith([IN]);

      await expect(
        service.postMessageHttp({
          conversationId: 'c1',
          content: 'I should not be able to write here.',
          senderId: OUT,
          recipientIds: [],
        })
      ).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
    });

    it('refuses a community conversation without authoritative membership', async () => {
      // ADD_TO_COMMUNITY_CHAT is a command with no implementation and no
      // caller, so a community conversation has an empty participant list for
      // life. Checking it would refuse everybody and break the feature.
      const conversation = Object.assign(new Conversation(), {
        id: 'c1',
        type: ConversationType.COMMUNITY,
        participants: [],
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'find').mockResolvedValue([]);

      await expect(service.getMessages('c1', OUT)).rejects.toBeInstanceOf(
        RpcException
      );
    });

    it('accepts a message from somebody in it', async () => {
      conversationWith([IN]);

      const message = await service.postMessageHttp({
        conversationId: 'c1',
        content: 'A note for the others.',
        senderId: IN,
        recipientIds: [],
      });

      expect(message.content).toBe('A note for the others.');
    });
  });

  describe('getOrCreateProjectChat', () => {
    it('makes one the first time, with everybody in it', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const made = await service.getOrCreateProjectChat(
        'p1',
        'owner',
        ['member'],
        'Kiln rebuild'
      );

      expect(made.type).toBe(ConversationType.PROJECT);
      expect(made.projectId).toBe('p1');
      expect(made.participants).toEqual(['owner', 'member']);
      expect(made.title).toBe('Kiln rebuild');
    });

    it('does not make a second one for the same project', async () => {
      const existing = Object.assign(new Conversation(), {
        id: 'c1',
        type: ConversationType.PROJECT,
        projectId: 'p1',
        participants: ['owner', 'member'],
        title: 'Kiln rebuild',
      });
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existing);
      const create = jest.spyOn(conversationRepository, 'create');

      const found = await service.getOrCreateProjectChat(
        'p1',
        'owner',
        ['member'],
        'Kiln rebuild'
      );

      expect(found.id).toBe('c1');
      expect(create).not.toHaveBeenCalled();
    });

    it('writes somebody out who is no longer on the project', async () => {
      // The whole point. Otherwise a removed member keeps reading it.
      const existing = Object.assign(new Conversation(), {
        id: 'c1',
        type: ConversationType.PROJECT,
        projectId: 'p1',
        participants: ['owner', 'gone'],
        title: 'Kiln rebuild',
      });
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existing);

      const found = await service.getOrCreateProjectChat(
        'p1',
        'owner',
        [],
        'Kiln rebuild'
      );

      expect(found.participants).toEqual(['owner']);
    });

    it('writes somebody in who has just joined', async () => {
      const existing = Object.assign(new Conversation(), {
        id: 'c1',
        type: ConversationType.PROJECT,
        projectId: 'p1',
        participants: ['owner'],
        title: 'Kiln rebuild',
      });
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existing);

      const found = await service.getOrCreateProjectChat(
        'p1',
        'owner',
        ['newcomer'],
        'Kiln rebuild'
      );

      expect(found.participants).toEqual(['owner', 'newcomer']);
    });

    it('keeps the owner in it once, even if they are also listed', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const made = await service.getOrCreateProjectChat('p1', 'owner', [
        'owner',
        'member',
      ]);

      expect(made.participants).toEqual(['owner', 'member']);
    });
  });

  describe('getConversations', () => {
    it('should return conversations for a given profileId', async () => {
      const profileId = 'user1';
      const mockConversations = [
        {
          id: 'conv1',
          participants: ['user1', 'user2'],
          messages: [
            { createdAt: new Date('2023-01-02') },
            { createdAt: new Date('2023-01-01') },
          ],
        },
      ];
      jest
        .spyOn(conversationRepository, 'find')
        .mockResolvedValue(mockConversations as any);

      const result = await service.getConversations(profileId);

      expect(logger.log).toHaveBeenCalledWith(
        `Retrieving conversations for profile ID: ${profileId}`
      );
      expect(conversationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ participants: expect.anything() }),
          ]),
          relations: ['messages'],
          order: { createdAt: 'DESC' },
        })
      );
      expect(result[0].messages[0].createdAt.getTime()).toBe(
        new Date('2023-01-01').getTime()
      ); // Check sorting
    });
  });

  describe('getConversation', () => {
    it('should return a single conversation by ID', async () => {
      const conversationId = 'conv1';
      const mockConversation = {
        id: conversationId,
        participants: [],
        messages: [],
      };
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation as any);

      const result = await service.getConversation(conversationId);

      expect(logger.log).toHaveBeenCalledWith(
        `Retrieving conversation for ID: ${conversationId}`
      );
      expect(conversationRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: conversationId, isDeleted: false },
          relations: ['messages'],
        })
      );
      expect(result).toEqual(mockConversation);
    });
  });

  describe('createDirectChat', () => {
    it('rejects direct conversations that do not have exactly two distinct participants', async () => {
      await expect(service.createDirectChat(['profile-1'])).rejects.toThrow(
        'exactly two distinct participants'
      );
      await expect(
        service.createDirectChat(['profile-1', 'profile-1'])
      ).rejects.toThrow('exactly two distinct participants');
      await expect(
        service.createDirectChat(['profile-1', 'profile-2', 'profile-3'])
      ).rejects.toThrow('exactly two distinct participants');
      await expect(service.createDirectChat(['profile-1', ''])).rejects.toThrow(
        BadRequestException
      );
    });

    it('returns the existing conversation when one already exists', async () => {
      const existing = Object.assign(new Conversation(), { id: 'existing' });
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existing);

      const result = await service.createDirectChat(['profile-2', 'profile-1']);

      expect(conversationRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: ConversationType.DIRECT,
            isDeleted: false,
          }),
        })
      );
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('creates a new direct conversation with sorted participants when none exists', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.createDirectChat(['profile-2', 'profile-1']);

      expect(conversationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Direct Chat',
          type: ConversationType.DIRECT,
          participants: ['profile-1', 'profile-2'],
        })
      );
      expect(conversationRepository.save).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Conversation);
    });
  });

  describe('getOrCreateDirectChat', () => {
    it('delegates to createDirectChat', async () => {
      const spy = jest
        .spyOn(service, 'createDirectChat')
        .mockResolvedValue({ id: 'conv1' } as any);

      const result = await service.getOrCreateDirectChat(['a', 'b']);

      expect(spy).toHaveBeenCalledWith(['a', 'b']);
      expect(result).toEqual({ id: 'conv1' });
    });
  });

  describe('createCommunityChat', () => {
    it('returns the existing community chat when one already exists', async () => {
      const existing = Object.assign(new Conversation(), { id: 'existing' });
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existing);

      const result = await service.createCommunityChat(
        'community-1',
        'owner-1'
      );

      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('creates a new community chat with a default title when none is given', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.createCommunityChat(
        'community-1',
        'owner-1'
      );

      expect(conversationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Community Chat',
          type: ConversationType.COMMUNITY,
          communityId: 'community-1',
          ownerId: 'owner-1',
          participants: [],
        })
      );
      expect(result).toBeInstanceOf(Conversation);
    });

    it('creates a new community chat with a provided name', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      await service.createCommunityChat(
        'community-1',
        'owner-1',
        'Custom Name'
      );

      expect(conversationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Custom Name' })
      );
    });
  });

  describe('deleteConversation', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.deleteConversation('missing', 'user-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'conv1',
        ownerId: 'owner-1',
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);

      await expect(
        service.deleteConversation('conv1', 'someone-else')
      ).rejects.toThrow(ForbiddenException);
    });

    it('marks the conversation deleted when the caller is the owner', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'conv1',
        ownerId: 'owner-1',
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);

      await service.deleteConversation('conv1', 'owner-1');

      expect(conversation.isDeleted).toBe(true);
      expect(conversationRepository.save).toHaveBeenCalledWith(conversation);
    });

    it('marks the conversation deleted when it has no owner', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'conv1',
        ownerId: null,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);

      await service.deleteConversation('conv1', 'anyone');

      expect(conversation.isDeleted).toBe(true);
    });
  });

  describe('deleteOwnedCommunityConversation', () => {
    const payload = {
      conversationId: '78c973a8-0d2b-4a59-b8b0-83b7a0a0c1d1',
      communityId: '67c973a8-0d2b-4a59-b8b0-83b7a0a0c1d2',
      actorProfileId: 'owner-profile',
      appScope: 'towne-square',
    };

    it('soft-deletes only an owned community conversation in the exact current owner scope', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: payload.conversationId,
        type: ConversationType.COMMUNITY,
        communityId: payload.communityId,
        ownerId: payload.actorProfileId,
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      jest.spyOn(messageRepository, 'delete');
      const socialClient = service['socialClient'] as any;
      jest.spyOn(socialClient, 'send').mockImplementation((pattern: any) => {
        if (pattern.cmd === CommunityCommands.FIND) {
          return of({
            id: payload.communityId,
            ownerProfileId: payload.actorProfileId,
            appScope: payload.appScope,
          });
        }
        if (pattern.cmd === CommunityCommands.GET_MEMBERS) {
          return of([
            {
              profileId: payload.actorProfileId,
              role: 'owner',
              status: 'approved',
            },
          ]);
        }
        return of([]);
      });

      await expect(
        (service as any).deleteOwnedCommunityConversation(payload)
      ).resolves.toEqual({ success: true });

      expect(conversationRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: payload.conversationId,
          isDeleted: false,
          type: ConversationType.COMMUNITY,
          communityId: payload.communityId,
          ownerId: payload.actorProfileId,
        }),
        { isDeleted: true }
      );
      expect(messageRepository.delete).not.toHaveBeenCalled();
    });

    it('rejects malformed UUIDs before a repository query or social lookup', async () => {
      const findOneSpy = jest.spyOn(conversationRepository, 'findOne');
      const socialClient = service['socialClient'] as any;
      const sendSpy = jest.spyOn(socialClient, 'send');

      await expect(
        (service as any).deleteOwnedCommunityConversation({
          ...payload,
          conversationId: 'not-a-uuid',
        })
      ).rejects.toBeInstanceOf(RpcException);

      expect(findOneSpy).not.toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['actorProfileId', 17],
      ['appScope', { unexpected: true }],
    ])(
      'rejects a non-string %s before repository access',
      async (key, value) => {
        const findOneSpy = jest.spyOn(conversationRepository, 'findOne');

        await expect(
          (service as any).deleteOwnedCommunityConversation({
            ...payload,
            [key]: value,
          })
        ).rejects.toMatchObject({ error: { statusCode: 400 } });

        expect(findOneSpy).not.toHaveBeenCalled();
      }
    );

    it('rejects a scope mismatch before attempting the conditional update', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: payload.conversationId,
        type: ConversationType.COMMUNITY,
        communityId: payload.communityId,
        ownerId: payload.actorProfileId,
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      const socialClient = service['socialClient'] as any;
      jest.spyOn(socialClient, 'send').mockImplementation((pattern: any) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? {
                id: payload.communityId,
                ownerProfileId: payload.actorProfileId,
                appScope: 'other-app',
              }
            : []
        )
      );

      await expect(
        (service as any).deleteOwnedCommunityConversation(payload)
      ).rejects.toBeInstanceOf(RpcException);

      expect(conversationRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a stale owner membership when the community record names another owner', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: payload.conversationId,
        type: ConversationType.COMMUNITY,
        communityId: payload.communityId,
        ownerId: payload.actorProfileId,
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      const socialClient = service['socialClient'] as any;
      jest.spyOn(socialClient, 'send').mockImplementation((pattern: any) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? {
                id: payload.communityId,
                ownerProfileId: 'different-current-owner',
                appScope: payload.appScope,
              }
            : [
                {
                  profileId: payload.actorProfileId,
                  role: 'owner',
                  status: 'approved',
                },
              ]
        )
      );

      await expect(
        (service as any).deleteOwnedCommunityConversation(payload)
      ).rejects.toMatchObject({ error: { statusCode: 403 } });
      expect(conversationRepository.update).not.toHaveBeenCalled();
    });

    it.each(['admin', 'moderator', 'member'])(
      'rejects an approved %s without owner status',
      async (role) => {
        const conversation = Object.assign(new Conversation(), {
          id: payload.conversationId,
          type: ConversationType.COMMUNITY,
          communityId: payload.communityId,
          ownerId: payload.actorProfileId,
          isDeleted: false,
        });
        jest
          .spyOn(conversationRepository, 'findOne')
          .mockResolvedValue(conversation);
        const socialClient = service['socialClient'] as any;
        jest.spyOn(socialClient, 'send').mockImplementation((pattern: any) =>
          of(
            pattern.cmd === CommunityCommands.FIND
              ? {
                  id: payload.communityId,
                  ownerProfileId: payload.actorProfileId,
                  appScope: payload.appScope,
                }
              : [
                  {
                    profileId: payload.actorProfileId,
                    role,
                    status: 'approved',
                  },
                ]
          )
        );

        await expect(
          (service as any).deleteOwnedCommunityConversation(payload)
        ).rejects.toBeInstanceOf(RpcException);

        expect(conversationRepository.update).not.toHaveBeenCalled();
      }
    );

    it('keeps a social authorization denial as a status-aware RPC denial', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: payload.conversationId,
        type: ConversationType.COMMUNITY,
        communityId: payload.communityId,
        ownerId: payload.actorProfileId,
        isDeleted: false,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      const socialClient = service['socialClient'] as any;
      jest
        .spyOn(socialClient, 'send')
        .mockReturnValueOnce(
          throwError(
            () => new RpcException({ statusCode: 403, message: 'denied' })
          )
        );

      await expect(
        (service as any).deleteOwnedCommunityConversation(payload)
      ).rejects.toMatchObject({
        error: { statusCode: 403, message: 'denied' },
      });
      expect(conversationRepository.update).not.toHaveBeenCalled();
    });

    it.each([
      ['direct conversation', { type: ConversationType.DIRECT }],
      ['project conversation', { type: ConversationType.PROJECT }],
      [
        'different community',
        { communityId: '77c973a8-0d2b-4a59-b8b0-83b7a0a0c1d3' },
      ],
      ['different recorded owner', { ownerId: 'other-profile' }],
      ['missing recorded owner', { ownerId: null }],
      ['already deleted conversation', { isDeleted: true }],
    ])('rejects a %s without soft-deleting it', async (_caseName, override) => {
      const conversation = Object.assign(new Conversation(), {
        id: payload.conversationId,
        type: ConversationType.COMMUNITY,
        communityId: payload.communityId,
        ownerId: payload.actorProfileId,
        isDeleted: false,
        ...override,
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);
      const socialClient = service['socialClient'] as any;
      jest.spyOn(socialClient, 'send').mockImplementation((pattern: any) => {
        if (pattern.cmd === CommunityCommands.FIND) {
          return of({
            id: payload.communityId,
            ownerProfileId: payload.actorProfileId,
            appScope: payload.appScope,
          });
        }
        return of([
          {
            profileId: payload.actorProfileId,
            role: 'owner',
            status: 'approved',
          },
        ]);
      });

      await expect(
        (service as any).deleteOwnedCommunityConversation(payload)
      ).rejects.toBeInstanceOf(RpcException);
      expect(conversationRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getConversationsHttp', () => {
    it('returns non-deleted conversations for the profile', async () => {
      const mockConversations = [
        { id: 'conv1', participants: ['user1'], messages: [] },
      ];
      jest
        .spyOn(conversationRepository, 'find')
        .mockResolvedValue(mockConversations as any);

      const result = await service.getConversationsHttp('user1');

      expect(conversationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ isDeleted: false }),
          ]),
          order: { createdAt: 'DESC' },
        })
      );
      expect(result).toEqual(mockConversations);
    });
  });

  describe('getConversationHttp', () => {
    it('returns the conversation when found', async () => {
      const mockConversation = { id: 'conv1' };
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation as any);

      const result = await service.getConversationHttp('conv1');

      expect(result).toEqual(mockConversation);
    });

    it('throws NotFoundException when the conversation is missing', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getConversationHttp('missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getMessages', () => {
    it('returns messages ordered by createdAt', async () => {
      const mockMessages = [{ id: 'msg1' }];
      jest
        .spyOn(messageRepository, 'find')
        .mockResolvedValue(mockMessages as any);

      const result = await service.getMessages('conv1');

      expect(messageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversation: { id: 'conv1' } },
          order: { createdAt: 'ASC' },
        })
      );
      expect(result).toEqual(mockMessages);
    });
  });

  describe('postMessageHttp', () => {
    it('associates the saved message with its conversation', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'conversation-1',
        // A sender who is in the conversation, which every real one has and
        // this fixture predated.
        participants: ['user-1', 'user-2'],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);

      await service.postMessageHttp({
        conversationId: 'conversation-1',
        content: 'Hello from HTTP',
        senderId: 'user-1',
        recipientIds: ['user-2'],
      });

      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 'user-1',
          recipients: ['user-2'],
          content: 'Hello from HTTP',
          type: MessageType.CHAT,
          conversation,
        })
      );
      expect(conversationRepository.update).toHaveBeenCalledWith(
        'conversation-1',
        { updatedAt: expect.any(Date) }
      );
      expect(conversationRepository.save).not.toHaveBeenCalled();
    });

    it('keeps concurrent HTTP message writes bound without saving stale conversation snapshots', async () => {
      const conversation = Object.assign(new Conversation(), {
        id: 'http-concurrent-conversation',
        participants: ['user-1', 'user-2'],
      });
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(conversation);

      await Promise.all(
        Array.from({ length: 60 }, (_, index) =>
          service.postMessageHttp({
            conversationId: conversation.id,
            content: `Concurrent HTTP message ${index}`,
            senderId: 'user-1',
            recipientIds: ['ignored-client-recipient'],
          })
        )
      );

      expect(messageRepository.save).toHaveBeenCalledTimes(60);
      for (const [message] of (messageRepository.create as jest.Mock).mock
        .calls) {
        expect(message.conversation).toBe(conversation);
      }
      expect(conversationRepository.update).toHaveBeenCalledTimes(60);
      expect(conversationRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a missing conversation the same way as a forbidden one', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      // Deliberate: a conversation that does not exist and one the caller is
      // not in answer identically, so ids cannot be probed. It is an
      // RpcException rather than an HttpException because the status does not
      // survive the TCP hop, which turned a refusal into a 500 at the gateway.
      await expect(
        service.postMessageHttp({
          conversationId: 'missing',
          content: 'hi',
          senderId: 'user-1',
          recipientIds: ['user-2'],
        })
      ).rejects.toThrow(RpcException);
    });
  });
});
