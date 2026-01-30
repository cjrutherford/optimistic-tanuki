import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { PLATFORM_ID, SimpleChange, SimpleChanges, signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { io } from 'socket.io-client';

import { ChatComponent } from './chat.component';
import { ProfileService } from './profile/profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  SocketChatService,
  ChatConversation,
  ChatMessage,
  SOCKET_HOST,
  SOCKET_NAMESPACE,
  SOCKET_IO_INSTANCE,
} from '@optimistic-tanuki/chat-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

class MockSocketChatService {
  onMessage = jest.fn();
  onConversations = jest.fn();
  getConversations = jest.fn();
  sendMessage = jest.fn();
  destroy = jest.fn();
}

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let profileService: ProfileService;
  let messageService: MessageService;
  let socketChatService: MockSocketChatService;

  const mockProfile: ProfileDto = {
    id: 'user1',
    userId: 'user1',
    profileName: 'Test User',
    profilePic: 'pic.jpg',
    coverPic: 'cover.jpg',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date(),
  };

  const mockConversation: ChatConversation = {
    id: 'conv1',
    participants: ['user1', 'user2'],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const profileServiceMock = {
      currentUserProfile: signal<ProfileDto | null>(mockProfile),
      getDisplayProfile: jest.fn().mockReturnValue(of(mockProfile)),
    };

    const messageServiceMock = {
      addMessage: jest.fn(),
    };

    const socketChatServiceMock = new MockSocketChatService();

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: SocketChatService, useValue: socketChatServiceMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    })
      .overrideComponent(ChatComponent, {
        set: { providers: [] }, // Remove component-level providers to use the test-level one
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(ProfileService);
    messageService = TestBed.inject(MessageService);
    socketChatService = TestBed.inject(
      SocketChatService
    ) as unknown as MockSocketChatService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize and subscribe to socket events on init', () => {
    expect(socketChatService.onMessage).toHaveBeenCalled();
    expect(socketChatService.onConversations).toHaveBeenCalled();
    expect(socketChatService.getConversations).toHaveBeenCalledWith('user1');
  });

  it('should handle new message submission', () => {
    component.conversations.set([mockConversation]);
    component.openChat(mockConversation.id);
    fixture.detectChanges();

    const messageText = 'Hello, world!';
    component.handleNewMessage(messageText, mockConversation.id);

    expect(socketChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: messageText,
        conversationId: mockConversation.id,
        senderId: 'user1',
      })
    );
  });

  it('should update contacts when conversations are received', async () => {
    const conversationsCallback =
      socketChatService.onConversations.mock.calls[0][0];
    conversationsCallback([mockConversation]);

    // Wait for the async updateContacts to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();

    // The current user profile should be added to contacts (even if no other participants)
    expect(component.contacts().length).toBeGreaterThan(0);
  });

  it('should manage chat window state', () => {
    component.conversations.set([mockConversation]);
    expect(component.isWindowOpen(mockConversation.id)).toBe(false);

    component.openChat(mockConversation.id);
    expect(component.isWindowOpen(mockConversation.id)).toBe(true);

    component.closeChat(mockConversation.id);
    expect(component.isWindowOpen(mockConversation.id)).toBe(false);
  });

  it('should post a message via the socket service', () => {
    const message: Partial<ChatMessage> = { content: 'test' };
    component.postMessage(message);
    expect(socketChatService.sendMessage).toHaveBeenCalledWith(message);
  });

  it('should not initialize socket connection if not in browser', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    // Re-create component with non-browser platform
    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    (component as any).platformId = 'server';
    component.ngOnInit();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not in browser'));
    consoleSpy.mockRestore();
  });

  it('should handle error when posting message if socket service is not available', () => {
    component.socketChat = null;
    const message: Partial<ChatMessage> = { content: 'test' };
    component.postMessage(message);
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  });

  it('should process external messages in ngOnChanges', () => {
    socketChatService.sendMessage.mockClear();
    const messages: Partial<ChatMessage>[] = [{ content: 'external' }];
    const changes: SimpleChanges = {
      externalMessages: new SimpleChange(null, messages, true), // isFirstChange = true
    };

    // Simulate first change (already handled in ngOnInit, so ngOnChanges should skip it)
    component.ngOnChanges(changes);
    expect(socketChatService.sendMessage).not.toHaveBeenCalled();

    // Simulate subsequent change
    const nextMessages: Partial<ChatMessage>[] = [{ content: 'next external' }];
    const nextChanges: SimpleChanges = {
      externalMessages: new SimpleChange(messages, nextMessages, false),
    };
    component.ngOnChanges(nextChanges);
    expect(socketChatService.sendMessage).toHaveBeenCalledWith(nextMessages[0]);
  });

  it('should destroy socketChat on ngOnDestroy', () => {
    component.ngOnDestroy();
    expect(socketChatService.destroy).toHaveBeenCalled();
  });

  it('should handle incoming messages', () => {
    component.conversations.set([mockConversation]);
    const incomingMessage: ChatMessage = {
      id: 'msg2',
      content: 'Incoming',
      senderId: 'user2',
      conversationId: 'conv1',
      recipientId: ['user1'],
      timestamp: new Date(),
      type: 'chat',
    };

    const messageCallback = socketChatService.onMessage.mock.calls[0][0];
    messageCallback(incomingMessage);

    const updatedConv = component.conversations().find((c) => c.id === 'conv1');
    expect(updatedConv?.messages.length).toBe(1);
    expect(updatedConv?.messages[0].id).toBe('msg2');
  });

  it('should handle window state changes', () => {
    component.handleWindowStateChange('conv1', 'popout');
    expect(component.isWindowOpen('conv1')).toBe(true);

    component.handleWindowStateChange('conv1', 'hidden');
    expect(component.isWindowOpen('conv1')).toBe(false);
  });

  it('should open existing persona chat', fakeAsync(() => {
    const personaId = 'persona1';
    const personaConv: ChatConversation = {
      ...mockConversation,
      id: 'personaConv',
      participants: ['user1', personaId],
    };
    component.conversations.set([personaConv]);

    component.openOrCreatePersonaChat(personaId);
    tick();

    expect(component.isWindowOpen('personaConv')).toBe(true);
    expect(component.selectedConversation()).toBe('personaConv');
  }));

  it('should show warning when opening persona chat if not logged in', fakeAsync(() => {
    (profileService.currentUserProfile as WritableSignal<ProfileDto | null>).set(null);

    component.openOrCreatePersonaChat('persona1');
    tick();

    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning' })
    );
  }));

  it('should open existing AI assistant chat', fakeAsync(() => {
    const aiConv: ChatConversation = {
      ...mockConversation,
      id: 'aiConv',
      participants: ['user1', 'ai-assistant'],
    };
    component.conversations.set([aiConv]);

    component.openAiAssistantChat();
    tick();

    expect(component.isWindowOpen('aiConv')).toBe(true);
    expect(component.selectedConversation()).toBe('aiConv');
  }));

  it('should update contacts and handle null current user', async () => {
    (profileService.currentUserProfile as WritableSignal<ProfileDto | null>).set(null);
    await component.updateContacts();
    expect(component.contacts()).toEqual([]);
  });

  it('should process external messages correctly', () => {
    const messages: Partial<ChatMessage>[] = [{ content: 'msg1' }, { content: 'msg2' }];
    component.processExternalMessages(messages);
    expect(socketChatService.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should log error if socketChat is null in processExternalMessages', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    component.socketChat = null;
    component.processExternalMessages([{ content: 'test' }]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SocketChatService is not available'));
    consoleSpy.mockRestore();
  });
});
