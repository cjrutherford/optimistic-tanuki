import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { MessagesComponent } from './messages.component';
import { ProfileService } from '../profile.service';
import { ChatService } from '../chat.service';
import { PresenceService } from '../presence.service';
import { ChatUiComponent, SocketChatService } from '@optimistic-tanuki/chat-ui';

describe('MessagesComponent', () => {
  let fixture: ComponentFixture<MessagesComponent>;
  let component: MessagesComponent;
  let chatService: {
    sendMessage: jest.Mock;
    getMessages: jest.Mock;
  };
  let socketChatService: {
    onConversations: jest.Mock;
    onMessage: jest.Mock;
    getConversations: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    chatService = {
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
    };

    socketChatService = {
      onConversations: jest.fn(),
      onMessage: jest.fn(),
      getConversations: jest.fn(),
      destroy: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: jest
              .fn()
              .mockReturnValue({ id: 'profile-1' }),
          },
        },
        {
          provide: ChatService,
          useValue: chatService,
        },
        {
          provide: PresenceService,
          useValue: {
            getPresenceBatch: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: HttpClient,
          useValue: {
            post: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
          },
        },
        {
          provide: SocketChatService,
          useValue: socketChatService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
    component.currentProfileId = 'profile-1';
  });

  it('renders the route chat surface with the embedded layout', () => {
    component.loading.set(false);
    component.chatContacts.set([{ id: 'room-1', name: 'General' }]);
    component.chatConversations.set([
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    fixture.detectChanges();

    const chatUi = fixture.debugElement.query(By.directive(ChatUiComponent))
      .componentInstance as ChatUiComponent;

    expect(chatUi.layout).toBe('embedded');
  });

  it('sends outgoing messages to the other conversation participants', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'profile-1',
      content: 'hello world',
      type: 'chat',
      recipients: ['other-profile'],
      createdAt: new Date('2026-07-05T18:20:00.000Z'),
    });

    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['profile-1', 'other-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await component.handleMessageSubmitted({
      conversationId: 'conversation-1',
      content: 'hello world',
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello world',
      senderId: 'profile-1',
      recipientIds: ['other-profile'],
    });
    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].content).toBe(
      'hello world'
    );
  });

  it('appends an outgoing message even when the API response omits conversationId', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 'message-2',
      senderId: 'profile-1',
      content: 'fallback conversation id',
      type: 'chat',
      recipients: ['other-profile'],
      createdAt: new Date('2026-07-05T18:25:00.000Z'),
    });

    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['profile-1', 'other-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await component.handleMessageSubmitted({
      conversationId: 'conversation-1',
      content: 'fallback conversation id',
    });

    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].conversationId).toBe(
      'conversation-1'
    );
  });

  it('appends incoming socket messages to the matching conversation', () => {
    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['profile-1', 'other-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    component.handleIncomingMessage({
      id: 'message-2',
      conversationId: 'conversation-1',
      senderId: 'other-profile',
      content: 'reply message',
      type: 'chat',
      recipientId: ['profile-1'],
      timestamp: new Date('2026-07-05T18:21:00.000Z'),
    });

    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].content).toBe(
      'reply message'
    );
  });

  it('destroys the socket chat service on teardown', () => {
    fixture.destroy();

    expect(socketChatService.destroy).toHaveBeenCalled();
  });
});
