import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SocketChatService } from '@optimistic-tanuki/chat-ui';
import { CommunityChatComponent } from './community-chat.component';
import { CommunityService } from '../services/community.service';

/**
 * TS4111 is on, so the doubles are described by named interfaces rather than an
 * index signature.
 */
interface SocketChatServiceMock {
  onConversations: jest.Mock;
  onMessage: jest.Mock;
  getConversations: jest.Mock;
  sendMessage: jest.Mock;
  destroy: jest.Mock;
}

interface CommunityServiceMock {
  findOne: jest.Mock;
  findBySlug: jest.Mock;
  getUserCommunities: jest.Mock;
  getCommunityChatRoom: jest.Mock;
  getCommunityChatConversation: jest.Mock;
  getCommunityChatMessages: jest.Mock;
  ensureCommunityChatRoom: jest.Mock;
  getProfilesByIds: jest.Mock;
}

const community = {
  id: 'community-1',
  name: 'General',
  ownerId: 'profile-1',
  logoUrl: 'logo.png',
};

const conversation = {
  id: 'room-1',
  participants: ['profile-1', 'profile-2'],
  createdAt: new Date('2026-07-05T10:00:00.000Z'),
  updatedAt: new Date('2026-07-05T10:00:00.000Z'),
};

/**
 * `ngOnInit` starts the no-slug branch without awaiting it, so tests that take
 * that path need the microtask queue to drain before asserting.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('CommunityChatComponent behaviour', () => {
  let component: CommunityChatComponent;
  let communityService: CommunityServiceMock;
  let socketChatService: SocketChatServiceMock;

  /**
   * Route params differ per scenario (slug present or absent), so the module is
   * configured inside each test rather than in a shared beforeEach.
   */
  const setup = (
    params: Record<string, string> = { communitySlug: 'general' }
  ) => {
    communityService = {
      findOne: jest.fn(),
      findBySlug: jest.fn(),
      getUserCommunities: jest.fn(),
      getCommunityChatRoom: jest.fn().mockResolvedValue(null),
      getCommunityChatConversation: jest.fn(),
      getCommunityChatMessages: jest.fn().mockResolvedValue([]),
      ensureCommunityChatRoom: jest.fn(),
      getProfilesByIds: jest.fn().mockResolvedValue([]),
    };

    socketChatService = {
      onConversations: jest.fn(),
      onMessage: jest.fn(),
      getConversations: jest.fn(),
      sendMessage: jest.fn(),
      destroy: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [CommunityChatComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ currentUserId: 'profile-1' }),
            snapshot: { paramMap: convertToParamMap(params) },
          },
        },
        { provide: CommunityService, useValue: communityService },
        { provide: SocketChatService, useValue: socketChatService },
      ],
    });

    component = TestBed.createComponent(
      CommunityChatComponent
    ).componentInstance;
  };

  beforeEach(() => {
    // The component logs every failure path; silence it so failing assertions
    // stay readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loading by slug', () => {
    it('reports a missing community and skips the chat lookup', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(null);

      await component.ngOnInit();

      expect(component.error()).toBe('Community not found');
      expect(component.community()).toBeNull();
      expect(communityService.getCommunityChatRoom).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('reports a failure when the community lookup throws', async () => {
      setup();
      communityService.findBySlug.mockRejectedValue(new Error('boom'));

      await component.ngOnInit();

      expect(component.error()).toBe('Failed to load community');
      expect(socketChatService.getConversations).not.toHaveBeenCalled();
    });

    it('marks the current user as owner and requests their conversations', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);

      await component.ngOnInit();

      expect(component.isOwnerOrManager()).toBe(true);
      expect(component.chatRoomId()).toBeNull();
      expect(socketChatService.getConversations).toHaveBeenCalledWith(
        'profile-1'
      );
    });

    it('does not treat a member of somebody else’s community as owner', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue({
        ...community,
        ownerId: 'profile-9',
      });

      await component.ngOnInit();

      expect(component.isOwnerOrManager()).toBe(false);
    });
  });

  describe('loading by id', () => {
    it('mounts the community chat room for a community id', async () => {
      setup();
      communityService.findOne.mockResolvedValue(community);
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation.mockResolvedValue(
        conversation
      );

      await component['loadCommunity']('community-1');

      expect(communityService.findOne).toHaveBeenCalledWith('community-1');
      expect(component.community()).toEqual(community);
      expect(component.chatRoomId()).toBe('room-1');
      expect(component.chatContacts()).toEqual([
        { id: 'room-1', name: 'General', profilePic: 'logo.png' },
      ]);
    });

    it('reports a missing community for an unknown id', async () => {
      setup();
      communityService.findOne.mockResolvedValue(null);

      await component['loadCommunity']('missing');

      expect(component.error()).toBe('Community not found');
      expect(communityService.getCommunityChatRoom).not.toHaveBeenCalled();
    });

    it('reports a failure when loading by id throws', async () => {
      setup();
      communityService.findOne.mockRejectedValue(new Error('boom'));

      await component['loadCommunity']('community-1');

      expect(component.error()).toBe('Failed to load community');
    });
  });

  describe('loading without a community slug', () => {
    it('falls back to the first community the user belongs to', async () => {
      setup({});
      communityService.getUserCommunities.mockResolvedValue([community]);
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation.mockResolvedValue(
        conversation
      );

      await component.ngOnInit();
      await settle();

      expect(communityService.findBySlug).not.toHaveBeenCalled();
      expect(component.community()).toEqual(community);
      expect(component.chatRoomId()).toBe('room-1');
      expect(component.loading()).toBe(false);
    });

    it('finishes loading with no chat room when the user has no communities', async () => {
      setup({});
      communityService.getUserCommunities.mockResolvedValue([]);

      await component.ngOnInit();
      await settle();

      expect(component.loading()).toBe(false);
      expect(component.chatRoomId()).toBeNull();
      expect(communityService.getCommunityChatRoom).not.toHaveBeenCalled();
      expect(socketChatService.getConversations).not.toHaveBeenCalled();
    });

    it('finishes loading when the user communities lookup throws', async () => {
      setup({});
      communityService.getUserCommunities.mockRejectedValue(new Error('boom'));

      await component.ngOnInit();
      await settle();

      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });
  });

  describe('chat room recovery', () => {
    it('creates a chat room for an owner when the existing room cannot be loaded', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation
        .mockRejectedValueOnce(new Error('gone'))
        .mockResolvedValueOnce({ ...conversation, id: 'room-2' });
      communityService.ensureCommunityChatRoom.mockResolvedValue({
        id: 'room-2',
      });

      await component.ngOnInit();

      expect(communityService.ensureCommunityChatRoom).toHaveBeenCalledWith(
        'community-1',
        'profile-1',
        'General'
      );
      expect(component.chatRoomId()).toBe('room-2');
      expect(component.chatConversations()[0].id).toBe('room-2');
      expect(component.error()).toBeNull();
    });

    it('surfaces a chat error for a non-owner when the room cannot be loaded', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue({
        ...community,
        ownerId: 'profile-9',
      });
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation.mockRejectedValue(
        new Error('gone')
      );

      await component.ngOnInit();

      expect(communityService.ensureCommunityChatRoom).not.toHaveBeenCalled();
      expect(component.error()).toBe('Failed to load community chat.');
    });

    it('ignores a create request while no community is loaded', async () => {
      setup();

      await component.createChatRoom();

      expect(communityService.ensureCommunityChatRoom).not.toHaveBeenCalled();
      expect(component.chatRoomId()).toBeNull();
    });

    it('reports a failure when the chat room cannot be created', async () => {
      setup();
      component.community.set(community as never);
      communityService.ensureCommunityChatRoom.mockRejectedValue(
        new Error('denied')
      );

      await component.createChatRoom();

      expect(component.error()).toBe('Failed to create chat room');
      expect(component.chatRoomId()).toBeNull();
    });
  });

  describe('sending messages', () => {
    it.each([
      {
        name: 'no signed in profile',
        currentUserId: '',
        conversationId: 'room-1',
      },
      {
        name: 'an unknown conversation',
        currentUserId: 'profile-1',
        conversationId: 'room-unknown',
      },
    ])('does not emit a socket message with $name', async (testCase) => {
      setup();
      component.currentUserId = testCase.currentUserId;
      component.chatConversations.set([
        {
          id: 'room-1',
          participants: ['profile-1', 'profile-2'],
          messages: [],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
        },
      ]);

      await component.handleMessageSubmitted({
        conversationId: testCase.conversationId,
        content: 'hello',
      });

      expect(socketChatService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('conversations pushed over the socket', () => {
    const loadedConversations = async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);
      await component.ngOnInit();
      return socketChatService.onConversations.mock.calls[0][0] as (
        conversations: unknown[]
      ) => Promise<void>;
    };

    it('ignores conversations while no community is selected', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(null);
      await component.ngOnInit();

      const onConversations = socketChatService.onConversations.mock
        .calls[0][0] as (conversations: unknown[]) => Promise<void>;
      await onConversations([
        {
          id: 'room-1',
          type: 'community',
          communityId: 'community-1',
          participants: ['profile-1'],
        },
      ]);

      expect(component.chatConversations()).toEqual([]);
      expect(component.chatRoomId()).toBeNull();
    });

    it('ignores conversations that belong to other communities', async () => {
      const onConversations = await loadedConversations();

      await onConversations([
        {
          id: 'room-9',
          type: 'community',
          communityId: 'community-9',
          participants: ['profile-1', 'profile-2'],
        },
        {
          id: 'room-8',
          type: 'direct',
          communityId: 'community-1',
          participants: ['profile-1', 'profile-2'],
        },
      ]);

      expect(component.chatContacts()).toEqual([]);
      expect(communityService.getCommunityChatMessages).not.toHaveBeenCalled();
    });

    it('summarises each channel with its most recent message', async () => {
      const onConversations = await loadedConversations();
      communityService.getProfilesByIds.mockResolvedValue([
        { id: 'profile-2', profileName: 'Member Two', profilePic: 'two.png' },
      ]);
      communityService.getCommunityChatMessages.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'room-1',
          senderId: 'profile-2',
          content: 'first',
          type: 'chat',
          recipients: ['profile-1'],
          createdAt: new Date('2026-07-05T10:01:00.000Z'),
        },
        {
          id: 'm2',
          conversationId: 'room-1',
          senderId: 'profile-2',
          content: 'latest',
          type: 'chat',
          recipients: ['profile-1'],
          createdAt: new Date('2026-07-05T10:02:00.000Z'),
        },
      ]);

      await onConversations([
        {
          id: 'room-1',
          type: 'community',
          communityId: 'community-1',
          participants: ['profile-1', 'profile-2'],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:02:00.000Z'),
        },
      ]);

      expect(component.chatContacts()[0]).toEqual(
        expect.objectContaining({
          id: 'room-1',
          lastMessage: 'latest',
          lastMessageTime: '2026-07-05T10:02:00.000Z',
        })
      );
      expect(component.chatConversations()[0].messages).toHaveLength(2);
      expect(component.chatRoomId()).toBe('room-1');
    });

    it('skips the profile lookup when the user is the only participant', async () => {
      const onConversations = await loadedConversations();

      await onConversations([
        {
          id: 'room-1',
          type: 'community',
          communityId: 'community-1',
          participants: ['profile-1'],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
        },
      ]);

      expect(communityService.getProfilesByIds).not.toHaveBeenCalled();
      expect(component.chatContacts()[0].name).toBe('General');
    });
  });

  describe('messages pushed over the socket', () => {
    const arrivingMessage = {
      id: 'm2',
      conversationId: 'room-1',
      senderId: 'profile-2',
      content: 'socket update',
      type: 'chat' as const,
      recipientId: ['profile-1'],
      timestamp: new Date('2026-07-05T10:03:00.000Z'),
    };

    const mountedWithOneConversation = async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);
      await component.ngOnInit();

      component.chatConversations.set([
        {
          id: 'room-1',
          participants: ['profile-1', 'profile-2'],
          messages: [arrivingMessage],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
        },
      ]);
      component.chatContacts.set([{ id: 'room-1', name: 'General' }]);

      return socketChatService.onMessage.mock.calls[0][0] as (
        message: typeof arrivingMessage
      ) => void;
    };

    it('leaves other conversations untouched', async () => {
      const onMessage = await mountedWithOneConversation();

      onMessage({ ...arrivingMessage, id: 'm3', conversationId: 'room-other' });

      expect(component.chatConversations()[0].messages).toHaveLength(1);
      expect(component.chatContacts()[0].lastMessage).toBeUndefined();
    });

    it('does not append a message it already holds', async () => {
      const onMessage = await mountedWithOneConversation();

      onMessage(arrivingMessage);

      expect(component.chatConversations()[0].messages).toHaveLength(1);
    });

    it('updates the contact preview when a new message arrives', async () => {
      const onMessage = await mountedWithOneConversation();

      onMessage({
        ...arrivingMessage,
        id: 'm4',
        content: 'newest',
        timestamp: new Date('2026-07-05T10:05:00.000Z'),
      });

      expect(component.chatConversations()[0].messages).toHaveLength(2);
      expect(component.chatContacts()[0]).toEqual(
        expect.objectContaining({
          lastMessage: 'newest',
          lastMessageTime: '2026-07-05T10:05:00.000Z',
        })
      );
    });
  });

  it('tears the shared socket down on destroy', () => {
    setup();

    component.ngOnDestroy();

    expect(socketChatService.destroy).toHaveBeenCalledTimes(1);
  });
});
