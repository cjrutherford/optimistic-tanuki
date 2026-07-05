import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagesComponent } from './messages.component';
import { ProfileService } from '../profile.service';
import { ChatService } from '../chat.service';
import { PresenceService } from '../presence.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SocketChatService } from '@optimistic-tanuki/chat-ui';
import { of } from 'rxjs';

describe('MessagesComponent', () => {
  let fixture: ComponentFixture<MessagesComponent>;
  let component: MessagesComponent;

  const profileServiceMock = {
    getCurrentUserProfile: jest.fn().mockReturnValue({
      id: 'self-profile',
      profileName: 'Self User',
    }),
  };

  const chatServiceMock = {
    sendMessage: jest.fn(),
    getMessages: jest.fn(),
  };

  const presenceServiceMock = {
    getPresenceBatch: jest.fn().mockReturnValue(of([])),
  };

  const httpMock = {
    post: jest.fn().mockReturnValue(of([])),
  };

  const routerMock = {
    navigate: jest.fn(),
  };

  const socketChatServiceMock = {
    onConversations: jest.fn(),
    onMessage: jest.fn(),
    getConversations: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
        { provide: PresenceService, useValue: presenceServiceMock },
        { provide: HttpClient, useValue: httpMock },
        { provide: Router, useValue: routerMock },
        { provide: SocketChatService, useValue: socketChatServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
    (component as any).currentProfileId = 'self-profile';
  });

  it('sends outgoing messages to the other conversation participants', async () => {
    chatServiceMock.sendMessage.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'self-profile',
      content: 'hello world',
      type: 'chat',
      recipients: ['other-profile'],
      createdAt: new Date('2026-07-05T18:20:00.000Z'),
    });

    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['self-profile', 'other-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await component.handleMessageSubmitted({
      conversationId: 'conversation-1',
      content: 'hello world',
    });

    expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello world',
      senderId: 'self-profile',
      recipientIds: ['other-profile'],
    });
    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].content).toBe(
      'hello world'
    );
  });

  it('appends an outgoing message even when the API response omits conversationId', async () => {
    chatServiceMock.sendMessage.mockResolvedValue({
      id: 'message-2',
      senderId: 'self-profile',
      content: 'fallback conversation id',
      type: 'chat',
      recipients: ['other-profile'],
      createdAt: new Date('2026-07-05T18:25:00.000Z'),
    });

    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['self-profile', 'other-profile'],
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
        participants: ['self-profile', 'other-profile'],
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
      recipientId: ['self-profile'],
      timestamp: new Date('2026-07-05T18:21:00.000Z'),
    });

    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].content).toBe(
      'reply message'
    );
  });
});
