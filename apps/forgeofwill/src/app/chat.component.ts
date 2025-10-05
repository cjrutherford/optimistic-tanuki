import { Component, computed, effect, Inject, PLATFORM_ID, signal, EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  imports: [ChatWindowComponent, ContactBubbleComponent],
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
  private injector = inject(EnvironmentInjector);

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
      // Watch for current user profile changes and connect when defined
      const checkAndConnect = async () => {
        const profile = this.profileService.currentUserProfile();
        if (profile && this.socketChat) {
          this.socketChat.onMessage((message) => {
            console.log('New message received:', message);
          });
          this.socketChat.onConversations((data: ChatConversation[]) => {
            console.log('Conversations update received:', data);
            this.conversations.update((conversations) => {
              const updatedConversations = [...conversations];
              data.forEach((newConv) => {
                const index = updatedConversations.findIndex((c) => c.id === newConv.id);
                if (index > -1) {
                  updatedConversations[index] = newConv;
                } else {
                  updatedConversations.push(newConv);
                }
              });
              return updatedConversations;
            });
            this.updateContacts();
          });
          this.socketChat.getConversations(profile.id);
        }
      };

      // Initial check
      checkAndConnect();

      // React to profile changes using a signal effect
      runInInjectionContext(this.injector, () => {
        const stopEffect = effect(() => {
          const profile = this.profileService.currentUserProfile();
          if (profile) {
            checkAndConnect();
            stopEffect.destroy();
          }
        });
      });
    }
  }

  handleNewMessage($event: string, conversationId: string) {
    const currentState = this.windowStates()[conversationId];
    if (currentState) {
      const senderId = this.profileService.currentUserProfile()?.id || '';
      const newMessage: Partial<ChatMessage> = {
        content: $event,
        senderId: senderId,
        conversationId: conversationId,
        recipientId: [...currentState.conversation.participants.filter((x: string) => x !== senderId)],
        timestamp: new Date(),
        type: 'chat',
      };
      this.postMessage(newMessage);
      // Optimistically update the conversation signal
      this.conversations.update(currentConversations => {
        const conversationIndex = currentConversations.findIndex(c => c.id === conversationId);
        if (conversationIndex > -1) {
          const updatedConversation = { ...currentConversations[conversationIndex] };
          updatedConversation.messages = [...updatedConversation.messages, { ...newMessage, id: 'pending' } as ChatMessage];
          const newConversations = [...currentConversations];
          newConversations[conversationIndex] = updatedConversation;
          return newConversations;
        }
        return currentConversations;
      });

      console.log(
        `New message sent for conversation ID ${conversationId}`,
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
  windowStates = computed(() => {
    const conversations = this.conversations();
    const obj: Record<
      string,
      { windowState: ChatWindowState; conversation: ChatConversation }
    > = {};
    const openWindows = this.openWindows();
    conversations.forEach((conv) => {
      const windowState: ChatWindowState =
        openWindows.has(conv.id)
          ? 'popout'
          : 'hidden';
      obj[conv.id] = {
        windowState: windowState || 'hidden',
        conversation: conv,
      };
    });
    return obj;
  });

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
  postMessage(message: Partial<ChatMessage>) {
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
