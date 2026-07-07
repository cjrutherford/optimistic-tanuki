import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagesComponent } from './messages.component';
import { AuthStateService } from '../../services/auth-state.service';
import { ChatService } from '../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { SocketChatService } from '@optimistic-tanuki/chat-ui';
import { of } from 'rxjs';

describe('LocalHub MessagesComponent', () => {
  let fixture: ComponentFixture<MessagesComponent>;
  let component: MessagesComponent;

  const authStateServiceMock = {
    getUserData: jest.fn().mockReturnValue({
      userId: 'self-user',
      profileId: 'self-profile',
      email: 'self@example.com',
      name: 'Self User',
    }),
  };

  const chatServiceMock = {
    sendMessage: jest.fn(),
  };

  const httpMock = {
    post: jest.fn().mockReturnValue(of([])),
    get: jest.fn().mockReturnValue(of([])),
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
        { provide: AuthStateService, useValue: authStateServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
        { provide: HttpClient, useValue: httpMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: {} },
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
      senderId: 'self-profile',
      content: 'hello from local hub',
      type: 'chat',
      recipients: ['other-profile'],
      createdAt: new Date('2026-07-05T19:00:00.000Z'),
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
      content: 'hello from local hub',
    });

    expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello from local hub',
      senderId: 'self-profile',
      recipientIds: ['other-profile'],
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
      content: 'reply from local hub',
      type: 'chat',
      recipientId: ['self-profile'],
      timestamp: new Date('2026-07-05T19:01:00.000Z'),
    });

    expect(component.chatConversations()[0].messages).toHaveLength(1);
    expect(component.chatConversations()[0].messages[0].content).toBe(
      'reply from local hub'
    );
  });
});
