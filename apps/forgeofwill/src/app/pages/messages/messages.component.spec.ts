import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChatUiComponent, SocketChatService } from '@optimistic-tanuki/chat-ui';
import { AuthStateService } from '../../auth-state.service';
import { MessagesComponent } from './messages.component';

describe('MessagesComponent', () => {
  let fixture: ComponentFixture<MessagesComponent>;
  let component: MessagesComponent;
  let socketChatService: {
    onConversations: jest.Mock;
    onMessage: jest.Mock;
    getConversations: jest.Mock;
    sendMessage: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    socketChatService = {
      onConversations: jest.fn(),
      onMessage: jest.fn(),
      getConversations: jest.fn(),
      sendMessage: jest.fn(),
      destroy: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            getDecodedTokenValue: jest.fn().mockReturnValue({
              profileId: 'profile-1',
            }),
          },
        },
        {
          provide: HttpClient,
          useValue: {
            get: jest.fn().mockReturnValue(of([])),
            post: jest.fn().mockReturnValue(of([])),
          },
        },
        provideRouter([]),
        { provide: SocketChatService, useValue: socketChatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
    (component as any).currentProfileId = 'profile-1';
  });

  it('sends submitted route messages over the socket', () => {
    component.loading.set(false);
    component.chatContacts.set([{ id: 'conversation-1', name: 'Bob' }]);
    component.chatConversations.set([
      {
        id: 'conversation-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    fixture.detectChanges();

    const chatUi = fixture.debugElement.query(By.directive(ChatUiComponent))
      .componentInstance as ChatUiComponent;
    chatUi.messageSubmitted.emit({
      conversationId: 'conversation-1',
      content: 'hello Bob',
    });

    expect(socketChatService.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello Bob',
      senderId: 'profile-1',
      recipientId: ['profile-2'],
      type: 'chat',
    });
  });

  it('keeps participant profiles when rehydrating conversations', async () => {
    const http = TestBed.inject(HttpClient) as unknown as {
      get: jest.Mock;
      post: jest.Mock;
    };
    http.post.mockReturnValue(
      of([
        { id: 'profile-1', profileName: 'Alice', profilePic: 'alice.png' },
        { id: 'profile-2', profileName: 'Bob', profilePic: 'bob.png' },
      ])
    );
    http.get.mockReturnValue(of([]));

    await (component as any).handleConversationsLoaded([
      {
        id: 'conversation-1',
        participants: ['profile-1', 'profile-2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    expect(component.chatConversations()[0].participantProfiles).toEqual([
      { id: 'profile-1', name: 'Alice', profilePic: 'alice.png' },
      { id: 'profile-2', name: 'Bob', profilePic: 'bob.png' },
    ]);
  });
});
