import { Component, Inject, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChatContact,
  ChatMessage,
  SocketChatService,
  ChatWindowComponent,
  ChatWindowState,
  ChatConversation,
  ContactBubbleComponent,
  SOCKET_HOST,
  SOCKET_NAMESPACE,
  SOCKET_IO_INSTANCE,
} from '@optimistic-tanuki/chat-ui';
import { ProfileService } from './profile/profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { firstValueFrom } from 'rxjs';
import { io } from 'socket.io-client';

@Component({
  standalone: true,
  selector: 'app-chat',
  imports: [CommonModule, ChatWindowComponent, ContactBubbleComponent],
  providers: [
    {
      provide: SocketChatService,
      useFactory: (
        platformId: object,
        socketHost: string,
        socketNamespace: string,
        socketIoInstance: typeof io
      ) => {
        if (isPlatformBrowser(platformId)) {
          return new SocketChatService(
            socketHost,
            socketNamespace,
            socketIoInstance
          );
        }
        return null;
      },
      deps: [PLATFORM_ID, SOCKET_HOST, SOCKET_NAMESPACE, SOCKET_IO_INSTANCE],
    },
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  socketChat?: SocketChatService | null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private profileService: ProfileService,
    private readonly messageService: MessageService,
    @Inject(SocketChatService)
    socketChatService: SocketChatService | null = null
  ) {
    this.socketChat = socketChatService;
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.socketChat) {
        this.socketChat.onMessage((message) => {
          console.log('New message received:', message);
        });
        this.socketChat.onConversations((data: ChatConversation[]) => {
          console.log('Conversations update received:', data);
          this.conversations.set(data);
          this.updateContacts();
        });
        const profileId = this.profileService.currentUserProfile()?.id;
        if (profileId) {
          this.socketChat.getConversations(profileId);
        }
      }
    }
  }

  handleNewMessage($event: string, conversationId: string) {
    const currentState = this.windowStates()[conversationId];
    if (currentState) {
      const newMessage: ChatMessage = {
        id: '',
        content: $event,
        senderId: this.profileService.currentUserProfile()?.id || '',
        conversationId: '',
        recipientId: [],
        timestamp: new Date(),
        type: 'info',
      };
      this.postMessage(newMessage);
      currentState.conversation.messages.push(newMessage);
      this.windowStates.set({
        ...this.windowStates(),
        [conversationId]: currentState,
      });
      console.log(
        `New message sent for conversation ID ${conversationId}:`,
        newMessage
      );
    } else {
      console.warn(
        `No window state found for conversation ID ${conversationId}`
      );
    }
  }

  contacts = signal<ChatContact[]>([]);

  private async updateContacts() {
    const conversations = this.conversations();
    const participantIds = new Set<string>();
    conversations.forEach((conv) => {
      conv.participants.forEach((id) => participantIds.add(id));
    });

    // Remove current user's profile id from contacts
    const currentUser = this.profileService.currentUserProfile();
    if (!currentUser) {
      this.contacts.set([]);
      return;
    }
    participantIds.delete(currentUser.id);

    // Convert participantIds to array and fetch profiles in parallel
    const ids = Array.from(participantIds);
    const contacts: ChatContact[] = (
      await Promise.all(
        ids.map(async (id) => {
          const profile = await firstValueFrom(
            this.profileService.getDisplayProfile(id)
          );
          if (profile) {
            return {
              id: profile.id,
              name: profile.profileName,
              avatarUrl:
                profile.profilePic ||
                'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
              lastMessage: '',
              lastMessageTime: new Date().toISOString(),
            } as ChatContact;
          }
          return null;
        })
      )
    ).filter((c): c is ChatContact => !!c);
    const currentUserContact: ChatContact = {
      id: currentUser.id,
      name: currentUser.profileName,
      avatarUrl:
        currentUser.profilePic ||
        'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
    };
    contacts.push(currentUserContact);
    this.contacts.set(contacts);
    this.windowStates.set(this.computeWindowStates());
  }
  openWindows = signal<Set<string>>(new Set());

  // To open a window:
  openChat(conversationId: string) {
    const open = new Set(this.openWindows());
    open.add(conversationId);
    this.openWindows.set(open);
    this.selectedConversation.set(conversationId);
  }

  // To close a window:
  closeChat(conversationId: string) {
    const open = new Set(this.openWindows());
    open.delete(conversationId);
    this.openWindows.set(open);
  }

  // To check if a window is open:
  isWindowOpen(conversationId: string): boolean {
    return this.openWindows().has(conversationId);
  }
  // Computed signal for window states as a Map
  windowStates = signal<
    Record<
      string,
      { windowState: ChatWindowState; conversation: ChatConversation }
    >
  >({});

  private computeWindowStates(): Record<
    string,
    { windowState: ChatWindowState; conversation: ChatConversation }
  > {
    const conversations = this.conversations();
    const obj: Record<
      string,
      { windowState: ChatWindowState; conversation: ChatConversation }
    > = {};
    const selectedConversationId = this.selectedConversation();
    conversations.forEach((conv) => {
      const windowState: ChatWindowState =
        selectedConversationId && selectedConversationId === conv.id
          ? 'popout'
          : 'hidden';
      obj[conv.id] = {
        windowState: windowState || 'hidden',
        conversation: conv,
      };
    });
    return obj;
  }

  selectedConversation = signal<string | null>(null);
  conversations = signal<ChatConversation[]>([], {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  getLoadedContacts(contactIds: string[]) {
    return this.contacts().filter((contact) => contactIds.includes(contact.id));
  }

  handleWindowStateChange(conversationId: string, newState: ChatWindowState) {
    const open = new Set(this.openWindows());
    if (newState === 'popout') {
      open.add(conversationId);
    } else {
      open.delete(conversationId);
    }
    this.openWindows.set(open);
  }

  /**
   * Sends a chat message using the SocketChatService.
   * @param message The chat message to send.
   */
  postMessage(message: ChatMessage) {
    if (this.socketChat) {
      this.socketChat.sendMessage(message);
      console.log('Message sent:', message);
    } else {
      console.error('SocketChatService is not initialized.');
      this.messageService.addMessage({
        content: 'SocketChatService is not initialized.',
        type: 'error',
      });
    }
  }
}
