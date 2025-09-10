import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { io } from 'socket.io-client';

import { ChatComponent } from './chat.component';
import { ProfileService } from './profile/profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { SocketChatService, ChatConversation, ChatMessage, SOCKET_HOST, SOCKET_NAMESPACE, SOCKET_IO_INSTANCE } from '@optimistic-tanuki/chat-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

class MockSocketChatService {
  onMessage = jest.fn();
  onConversations = jest.fn();
  getConversations = jest.fn();
  sendMessage = jest.fn();
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
      currentUserProfile: jest.fn().mockReturnValue(mockProfile),
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
    }).overrideComponent(ChatComponent, {
      set: { providers: [] } // Remove component-level providers to use the test-level one
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(ProfileService);
    messageService = TestBed.inject(MessageService);
    socketChatService = TestBed.inject(SocketChatService) as unknown as MockSocketChatService;
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

    expect(socketChatService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: messageText,
      conversationId: mockConversation.id,
      senderId: 'user1',
    }));
  });

  it('should update contacts when conversations are received', fakeAsync(() => {
    const conversationsCallback = socketChatService.onConversations.mock.calls[0][0];
    conversationsCallback([mockConversation]);
    tick(); // for promises in updateContacts
    fixture.detectChanges();
    
    expect(component.contacts().length).toBeGreaterThan(0);
  }));

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

  it('should handle error when posting message if socket service is not available', () => {
    component.socketChat = null;
    const message: Partial<ChatMessage> = { content: 'test' };
    component.postMessage(message);
    expect(messageService.addMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});
