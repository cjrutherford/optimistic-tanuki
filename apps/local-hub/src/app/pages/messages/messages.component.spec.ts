import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagesComponent } from './messages.component';
import { AuthStateService } from '../../services/auth-state.service';
import { ChatService } from '../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { SocketChatService } from '@optimistic-tanuki/chat-ui';
import { of, Subject } from 'rxjs';

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
    getMessages: jest.fn(),
  };

  const httpMock = {
    post: jest.fn().mockReturnValue(of([])),
    get: jest.fn().mockReturnValue(of([])),
  };

  const routerMock = {
    navigate: jest.fn(),
  };

  const socketChatServiceMock = {
    onConnectionState: jest.fn().mockReturnValue(() => {}),
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

  it('hydrates historical authors and keeps messages when profiles fail', async () => {
    const messages = ['self-profile', 'other', 'left'].map((senderId, i) => ({
      id: `${i}`,
      conversationId: 'room',
      senderId,
      content: 'hello',
      createdAt: new Date(),
    }));
    chatServiceMock.getMessages.mockResolvedValue(messages);
    httpMock.post.mockReturnValueOnce(
      of(
        ['self-profile', 'other', 'left'].map((id) => ({ id, profileName: id }))
      )
    );
    const rooms = [
      {
        id: 'room',
        type: 'community',
        title: 'Room',
        participants: ['other'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await (component as any).handleConversationsLoaded(rooms);
    expect(
      component.chatConversations()[0].participantProfiles?.map((p) => p.name)
    ).toEqual(['other', 'self-profile', 'left']);
    expect(component.chatConversations()[0].messages).toHaveLength(3);
    httpMock.post.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    await (component as any).handleConversationsLoaded(rooms);
    expect(component.chatConversations()[0].messages).toHaveLength(3);
  });

  it('does not restore history after the session changes during profile lookup', async () => {
    const response = new Subject<any[]>();
    httpMock.post.mockReturnValueOnce(response);
    chatServiceMock.getMessages.mockResolvedValue([
      {
        id: 'm',
        conversationId: 'room',
        senderId: 'other',
        content: 'old',
        createdAt: new Date(),
      },
    ]);
    const loading = (component as any).handleConversationsLoaded([
      {
        id: 'room',
        participants: ['other'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    for (let i = 0; i < 10 && !httpMock.post.mock.calls.length; i++)
      await Promise.resolve();
    expect(httpMock.post).toHaveBeenCalled();
    component.clearSessionViews();
    response.next([{ id: 'other', profileName: 'Old name' }]);
    response.complete();
    await loading;
    expect(component.chatConversations()).toEqual([]);
  });

  it('tracks transport connection and disposes the listener', async () => {
    let update!: (connected: boolean) => void;
    const dispose = jest.fn();
    socketChatServiceMock.onConnectionState.mockImplementation((callback) => {
      update = callback;
      return dispose;
    });
    await component.ngOnInit();
    expect(component.connectionStatus()).toBe('connecting');
    update(true);
    expect(component.connectionStatus()).toBe('connected');
    update(false);
    expect(component.connectionStatus()).toBe('reconnecting');
    update(true);
    expect(component.connectionStatus()).toBe('connected');
    component.ngOnDestroy();
    expect(dispose).toHaveBeenCalled();
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
  it('clears loaded conversation content at the session reset boundary', () => {
    component.chatContacts.set([{ id: 'private', name: 'private' }]);
    component.chatConversations.set([
      {
        id: 'private',
        participants: ['self-profile'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    component.clearSessionViews();
    expect(component.currentProfileId).toBeNull();
    expect(component.chatContacts()).toEqual([]);
    expect(component.chatConversations()).toEqual([]);
    expect(socketChatServiceMock.destroy).toHaveBeenCalled();
  });
});
