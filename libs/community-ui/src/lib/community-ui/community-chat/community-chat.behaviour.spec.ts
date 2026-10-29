import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
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
  onConnectionState: jest.Mock;
  getConversations: jest.Mock;
  sendDraftMessage: jest.Mock;
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
  ownerId: 'account-1',
  ownerProfileId: 'profile-1',
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
    const routeData = new BehaviorSubject({ currentUserId: 'profile-1' });
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
      onConnectionState: jest.fn(),
      getConversations: jest.fn(),
      sendDraftMessage: jest.fn().mockResolvedValue({ success: true }),
      destroy: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [CommunityChatComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: routeData.asObservable(),
            paramMap: of(convertToParamMap(params)),
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
    return { routeData };
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
        ownerId: 'account-9',
        ownerProfileId: 'profile-9',
      });

      await component.ngOnInit();

      expect(component.isOwnerOrManager()).toBe(false);
    });

    it('does not let an older community lookup replace the newer route state', async () => {
      setup();
      const nextCommunity = {
        ...community,
        id: 'community-2',
        name: 'Next',
        ownerId: 'account-9',
        ownerProfileId: 'profile-9',
      };
      let resolveInitialCommunity!: (value: typeof community) => void;
      communityService.findBySlug.mockImplementation((slug: string) =>
        slug === 'general'
          ? new Promise<typeof community>(
              (resolve) => (resolveInitialCommunity = resolve)
            )
          : Promise.resolve(nextCommunity)
      );
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-2' });
      communityService.getCommunityChatConversation.mockResolvedValue({
        ...conversation,
        id: 'room-2',
      });
      communityService.getCommunityChatMessages.mockResolvedValue([
        {
          id: 'next-message',
          conversationId: 'room-2',
          senderId: 'profile-2',
          content: 'current route history',
          type: 'chat',
          recipients: ['profile-1'],
          createdAt: new Date('2026-07-05T10:01:00.000Z'),
        },
      ]);

      const initialLoad = component.ngOnInit();
      await component['loadCommunityBySlug']('next');
      resolveInitialCommunity(community);
      await initialLoad;

      expect(component.community()?.id).toBe('community-2');
      expect(component.chatRoomId()).toBe('room-2');
      expect(component.chatContacts()).toEqual([
        expect.objectContaining({ id: 'room-2', name: 'Next' }),
      ]);
      expect(component.chatConversations()).toEqual([
        expect.objectContaining({
          id: 'room-2',
          messages: [expect.objectContaining({ id: 'next-message' })],
        }),
      ]);
      expect(communityService.getCommunityChatRoom).toHaveBeenCalledTimes(1);
      expect(communityService.getCommunityChatRoom).toHaveBeenCalledWith(
        'community-2'
      );
    });

    it('does not let an older community failure replace the newer route state', async () => {
      setup();
      let rejectInitialCommunity!: (reason: Error) => void;
      communityService.findBySlug.mockImplementation((slug: string) =>
        slug === 'general'
          ? new Promise<typeof community>(
              (_, reject) => (rejectInitialCommunity = reject)
            )
          : Promise.resolve({ ...community, id: 'community-2', name: 'Next' })
      );

      const initialLoad = component.ngOnInit();
      await component['loadCommunityBySlug']('next');
      rejectInitialCommunity(new Error('stale request failed'));
      await initialLoad;

      expect(component.community()?.id).toBe('community-2');
      expect(component.error()).toBeNull();
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

    it('ignores a community-list response after the signed-in profile changes', async () => {
      const { routeData } = setup({});
      let resolveCommunities!: (value: (typeof community)[]) => void;
      communityService.getUserCommunities.mockReturnValueOnce(
        new Promise<(typeof community)[]>(
          (resolve) => (resolveCommunities = resolve)
        )
      );

      communityService.getUserCommunities.mockResolvedValueOnce([]);

      await component.ngOnInit();
      routeData.next({ currentUserId: 'profile-2' });
      resolveCommunities([community]);
      await settle();

      expect(component.community()).toBeNull();
      expect(component.chatRoomId()).toBeNull();
      expect(component.chatContacts()).toEqual([]);
      expect(component.chatConversations()).toEqual([]);
      expect(communityService.getCommunityChatRoom).not.toHaveBeenCalled();
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
        ownerId: 'account-9',
        ownerProfileId: 'profile-9',
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
        settle: jest.fn(),
      });

      expect(socketChatService.sendDraftMessage).not.toHaveBeenCalled();
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

    it('hydrates initial room history including departed authors', async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation.mockResolvedValue(
        conversation
      );
      communityService.getCommunityChatMessages.mockResolvedValue(
        ['profile-1', 'profile-2', 'left'].map((senderId, i) => ({
          id: `${i}`,
          conversationId: 'room-1',
          senderId,
          content: 'hello',
          createdAt: new Date(),
        }))
      );
      communityService.getProfilesByIds.mockResolvedValue(
        ['profile-1', 'profile-2', 'left'].map((id) => ({
          id,
          profileName: id,
        }))
      );
      await component.ngOnInit();
      expect(
        component.chatConversations()[0].participantProfiles?.map((p) => p.name)
      ).toEqual(expect.arrayContaining(['profile-1', 'profile-2', 'left']));
      expect(communityService.getProfilesByIds).toHaveBeenCalledWith(
        expect.arrayContaining(['profile-1', 'profile-2', 'left'])
      );
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

    const loadedAuthorizedRoom = async () => {
      setup();
      communityService.findBySlug.mockResolvedValue(community);
      communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
      communityService.getCommunityChatConversation.mockResolvedValue(
        conversation
      );
      await component.ngOnInit();
      return socketChatService.onConversations.mock.calls[0][0] as (
        conversations: unknown[]
      ) => Promise<void>;
    };

    it('retains REST-authorized room history after an empty socket snapshot', async () => {
      const onConversations = await loadedAuthorizedRoom();

      await onConversations([]);

      expect(
        communityService.getCommunityChatConversation
      ).toHaveBeenCalledTimes(2);
      expect(component.chatRoomId()).toBe('room-1');
      expect(component.chatConversations()).toEqual([
        expect.objectContaining({ id: 'room-1' }),
      ]);
      expect(component.error()).toBeNull();
    });

    it('clears the cached room when empty-snapshot reauthorization is denied', async () => {
      const onConversations = await loadedAuthorizedRoom();
      communityService.getCommunityChatConversation.mockRejectedValueOnce({
        status: 403,
      });

      await onConversations([]);

      expect(
        communityService.getCommunityChatConversation
      ).toHaveBeenCalledTimes(2);
      expect(component.chatRoomId()).toBeNull();
      expect(component.chatConversations()).toEqual([]);
      expect(component.error()).toBe(
        'Community chat is unavailable. Approved membership is required.'
      );
    });

    it('reports a missing room separately from denied membership', async () => {
      const onConversations = await loadedAuthorizedRoom();
      communityService.getCommunityChatConversation.mockRejectedValueOnce({
        status: 404,
      });

      await onConversations([]);

      expect(component.chatRoomId()).toBeNull();
      expect(component.error()).toBe('Community chat could not be found.');
      expect(component.error()).not.toContain('Approved membership');
    });

    it('reports an expired session separately from denied membership', async () => {
      const onConversations = await loadedAuthorizedRoom();
      communityService.getCommunityChatConversation.mockRejectedValueOnce({
        status: 401,
      });

      await onConversations([]);

      expect(component.chatRoomId()).toBeNull();
      expect(component.error()).toBe('Sign in again to access community chat.');
      expect(component.error()).not.toContain('Approved membership');
    });

    it('reports a temporary access-check failure without claiming membership denial', async () => {
      const onConversations = await loadedAuthorizedRoom();
      communityService.getCommunityChatConversation.mockRejectedValueOnce({
        statusCode: 503,
      });

      await onConversations([]);

      expect(component.chatRoomId()).toBeNull();
      expect(component.error()).toBe(
        'Failed to verify community chat access. Please try again.'
      );
      expect(component.error()).not.toContain('Approved membership');
    });

    it('ignores empty-snapshot reauthorization that finishes after route change', async () => {
      const onConversations = await loadedAuthorizedRoom();
      let finishAuthorization!: (value: typeof conversation) => void;
      communityService.getCommunityChatConversation.mockReturnValueOnce(
        new Promise((resolve) => (finishAuthorization = resolve))
      );
      communityService.findBySlug.mockResolvedValueOnce({
        ...community,
        id: 'community-2',
        name: 'Next',
      });
      communityService.getCommunityChatRoom.mockResolvedValueOnce(null);

      const authorization = onConversations([]);
      await component['loadCommunityBySlug']('next');
      finishAuthorization(conversation);
      await authorization;

      expect(component.community()?.id).toBe('community-2');
      expect(component.chatRoomId()).toBeNull();
      expect(component.chatConversations()).toEqual([]);
      expect(component.error()).toBeNull();
    });

    it('looks up the current actor when they are the only participant', async () => {
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

      expect(communityService.getProfilesByIds).toHaveBeenCalledWith([
        'profile-1',
      ]);
      expect(component.chatContacts()[0].name).toBe('General');
    });

    it('keeps a live message that arrives while authorized history is loading', async () => {
      const onConversations = await loadedConversations();
      component.chatConversations.set([
        {
          id: 'room-1',
          participants: ['profile-1', 'profile-2'],
          messages: [],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
        },
      ]);
      let finishHistory!: (messages: unknown[]) => void;
      communityService.getCommunityChatMessages.mockReturnValue(
        new Promise((resolve) => (finishHistory = resolve)) as any
      );
      const historyLoad = onConversations([
        {
          id: 'room-1',
          type: 'community',
          communityId: 'community-1',
          participants: ['profile-1', 'profile-2'],
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
        },
      ]);

      const onMessage = socketChatService.onMessage.mock.calls[0][0] as (
        message: any
      ) => void;
      onMessage({
        id: 'm2',
        conversationId: 'room-1',
        senderId: 'profile-2',
        content: 'socket update',
        type: 'chat',
        recipientId: ['profile-1'],
        timestamp: new Date('2026-07-05T10:03:00.000Z'),
      });
      finishHistory([]);
      await historyLoad;

      expect(component.chatConversations()[0].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'm2', content: 'socket update' }),
        ])
      );
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

  it('leaves the shared socket connected when its view is destroyed', () => {
    setup();

    component.ngOnDestroy();

    expect(socketChatService.destroy).not.toHaveBeenCalled();
  });
});
