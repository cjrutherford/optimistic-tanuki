import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { CommunityChatComponent } from './community-chat.component';
import { CommunityService } from '../services/community.service';
import { ChatUiComponent, SocketChatService } from '@optimistic-tanuki/chat-ui';

describe('CommunityChatComponent', () => {
  let fixture: ComponentFixture<CommunityChatComponent>;
  let component: CommunityChatComponent;
  let communityService: jest.Mocked<CommunityService>;
  let socketChatService: {
    onConversations: jest.Mock;
    onMessage: jest.Mock;
    onConnectionState: jest.Mock;
    getConversations: jest.Mock;
    sendDraftMessage: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    const communityServiceMock = {
      findBySlug: jest.fn(),
      getCommunityChatRoom: jest.fn(),
      getCommunityChatConversation: jest.fn(),
      getCommunityChatMessages: jest.fn(),
      sendCommunityChatMessage: jest.fn(),
      ensureCommunityChatRoom: jest.fn(),
      getUserCommunities: jest.fn(),
      getProfilesByIds: jest.fn(),
    } as unknown as jest.Mocked<CommunityService>;

    socketChatService = {
      onConversations: jest.fn(),
      onMessage: jest.fn(),
      onConnectionState: jest.fn(),
      getConversations: jest.fn(),
      sendDraftMessage: jest.fn().mockResolvedValue({ success: true }),
      destroy: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommunityChatComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ currentUserId: 'profile-1' }),
            paramMap: of(convertToParamMap({ communitySlug: 'general' })),
            snapshot: {
              paramMap: convertToParamMap({ communitySlug: 'general' }),
            },
          },
        },
        {
          provide: CommunityService,
          useValue: communityServiceMock,
        },
        {
          provide: SocketChatService,
          useValue: socketChatService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityChatComponent);
    component = fixture.componentInstance;
    communityService = TestBed.inject(
      CommunityService
    ) as jest.Mocked<CommunityService>;
  });

  it('loads community chat messages once a chat room exists', async () => {
    communityService.findBySlug.mockResolvedValue({
      id: 'community-1',
      name: 'General',
      ownerId: 'profile-1',
      logoUrl: 'logo.png',
    } as any);
    communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
    communityService.getCommunityChatConversation.mockResolvedValue({
      id: 'room-1',
      participants: ['profile-1', 'profile-2'],
      createdAt: new Date('2026-07-05T10:00:00.000Z'),
      updatedAt: new Date('2026-07-05T10:00:00.000Z'),
    } as any);
    communityService.getCommunityChatMessages.mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'room-1',
        senderId: 'profile-2',
        content: 'hello',
        type: 'chat',
        recipients: ['profile-1'],
        createdAt: new Date('2026-07-05T10:01:00.000Z'),
      },
    ] as any);

    await component.ngOnInit();

    expect(component.chatConversations()[0].type).toBe('community');
    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0]).toEqual(
      expect.objectContaining({
        id: 'm1',
        conversationId: 'room-1',
        content: 'hello',
      })
    );
  });

  it('renders community chat with the embedded chat layout', async () => {
    communityService.findBySlug.mockResolvedValue({
      id: 'community-1',
      name: 'General',
      ownerId: 'profile-1',
      logoUrl: 'logo.png',
    } as any);
    communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
    communityService.getCommunityChatConversation.mockResolvedValue({
      id: 'room-1',
      participants: ['profile-1', 'profile-2'],
      createdAt: new Date('2026-07-05T10:00:00.000Z'),
      updatedAt: new Date('2026-07-05T10:00:00.000Z'),
    } as any);
    communityService.getCommunityChatMessages.mockResolvedValue([] as any);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.chatRoomId()).toBe('room-1');
    const chatUi = fixture.debugElement.query(By.directive(ChatUiComponent))
      .componentInstance as ChatUiComponent;

    expect(chatUi.layout).toBe('embedded');
    expect(chatUi.autoOpenFirstConversation).toBe(true);
  });

  it('loads community channels from the current profile conversations and mounts the selected one', async () => {
    const conversationsHandler = jest.fn();
    socketChatService.onConversations.mockImplementation(conversationsHandler);

    communityService.findBySlug.mockResolvedValue({
      id: 'community-1',
      name: 'General',
      ownerId: 'profile-1',
      logoUrl: 'logo.png',
    } as any);
    communityService.getProfilesByIds.mockResolvedValue([
      {
        id: 'profile-2',
        profileName: 'Member Two',
        profilePic: 'two.png',
      },
    ] as any);
    communityService.getCommunityChatMessages.mockResolvedValue([] as any);

    await component.ngOnInit();

    const onConversations = socketChatService.onConversations.mock.calls[0][0];
    await onConversations([
      {
        id: 'room-1',
        title: 'General',
        type: 'community',
        communityId: 'community-1',
        participants: ['profile-1', 'profile-2'],
        isDeleted: false,
        createdAt: new Date('2026-07-05T10:00:00.000Z'),
        updatedAt: new Date('2026-07-05T10:05:00.000Z'),
      },
      {
        id: 'room-2',
        title: 'Moderators',
        type: 'community',
        communityId: 'community-1',
        participants: ['profile-1', 'profile-2'],
        isDeleted: false,
        createdAt: new Date('2026-07-05T10:00:00.000Z'),
        updatedAt: new Date('2026-07-05T10:06:00.000Z'),
      },
    ]);

    expect(component.chatContacts()).toHaveLength(2);
    expect(component.chatConversations()).toHaveLength(2);
    expect(component.chatConversations()[0].id).toBe('room-1');
    expect(component.chatConversations()[0]).toEqual(
      expect.objectContaining({
        participantProfiles: expect.arrayContaining([
          expect.objectContaining({ id: 'profile-2', name: 'Member Two' }),
        ]),
      })
    );
  });

  it('updates conversation history when a socket message arrives', async () => {
    communityService.findBySlug.mockResolvedValue({
      id: 'community-1',
      name: 'General',
      ownerId: 'profile-1',
      logoUrl: 'logo.png',
    } as any);
    communityService.getCommunityChatRoom.mockResolvedValue({ id: 'room-1' });
    communityService.getCommunityChatConversation.mockResolvedValue({
      id: 'room-1',
      participants: ['profile-1', 'profile-2'],
      createdAt: new Date('2026-07-05T10:00:00.000Z'),
      updatedAt: new Date('2026-07-05T10:00:00.000Z'),
    } as any);
    communityService.getCommunityChatMessages.mockResolvedValue([] as any);

    await component.ngOnInit();

    const onMessage = socketChatService.onMessage.mock.calls[0][0];
    onMessage({
      id: 'm2',
      conversationId: 'room-1',
      senderId: 'profile-2',
      content: 'socket update',
      type: 'chat',
      recipientId: ['profile-1'],
      timestamp: new Date('2026-07-05T10:03:00.000Z'),
    });

    expect(component.chatConversations()[0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'm2', content: 'socket update' }),
      ])
    );
  });

  it('sends a submitted community message through acknowledged shared socket delivery', async () => {
    component['currentUserId'] = 'profile-1';
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
      conversationId: 'room-1',
      content: 'hello',
      settle: jest.fn(),
    });

    expect(socketChatService.sendDraftMessage).toHaveBeenCalledWith({
      conversationId: 'room-1',
      content: 'hello',
      senderId: 'profile-1',
      recipientId: ['profile-2'],
      type: 'chat',
    });
    expect(
      socketChatService.sendDraftMessage.mock.calls[0][0]
    ).not.toHaveProperty('id');
    expect(communityService.sendCommunityChatMessage).not.toHaveBeenCalled();
  });
});
