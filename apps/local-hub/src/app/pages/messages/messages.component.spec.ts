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
    sendDraftMessage: jest.fn(),
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

  it('sends outgoing messages through the acknowledged socket path', async () => {
    socketChatServiceMock.sendDraftMessage.mockResolvedValue({
      success: true,
      messageId: 'message-1',
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

    const settle = jest.fn();
    await component.handleMessageSubmission({
      conversationId: 'conversation-1',
      content: 'hello from local hub',
      settle,
    });

    expect(socketChatServiceMock.sendDraftMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello from local hub',
      senderId: 'self-profile',
      recipientId: ['other-profile'],
      type: 'chat',
    });
    expect(settle).toHaveBeenCalledWith(true);
  });

  it('retains a rejected draft when socket persistence fails', async () => {
    socketChatServiceMock.sendDraftMessage.mockRejectedValue(
      Object.assign(new Error('persistence denied'), { statusCode: 403 })
    );
    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['self-profile', 'other-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const settle = jest.fn();
    await component.handleMessageSubmission({
      conversationId: 'conversation-1',
      content: 'keep this draft',
      settle,
    });

    expect(settle).toHaveBeenCalledWith(false);
    expect(socketChatServiceMock.sendDraftMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'keep this draft' })
    );
  });

  it('rejects a draft when the authenticated conversation is unavailable', async () => {
    const settle = jest.fn();

    await component.handleMessageSubmission({
      conversationId: 'unknown-conversation',
      content: 'must not send',
      settle,
    });

    expect(socketChatServiceMock.sendDraftMessage).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledWith(false);
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
