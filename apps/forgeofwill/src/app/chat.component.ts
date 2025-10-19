import {
  Component,
  Inject,
  PLATFORM_ID,
  signal,
  computed,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
  effect,
} from '@angular/core';
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
      ) =>
        isPlatformBrowser(platformId)
          ? new SocketChatService(socketHost, socketNamespace, socketIoInstance)
          : null,
      deps: [PLATFORM_ID, SOCKET_HOST, SOCKET_NAMESPACE, SOCKET_IO_INSTANCE],
    },
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  socketChat?: SocketChatService | null;
  private injector = inject(EnvironmentInjector);

  contacts = signal<ChatContact[]>([]);
  conversations = signal<ChatConversation[]>([], {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  openWindows = signal<Set<string>>(new Set());
  selectedConversation = signal<string | null>(null);

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private profileService: ProfileService,
    private readonly messageService: MessageService,
    @Inject(SocketChatService)
    socketChatService: SocketChatService | null = null
  ) {
    this.socketChat = socketChatService;
    console.log('ChatComponent initialized with SocketChatService:', this.socketChat);
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId) || !this.socketChat) return;

    const connect = async () => {
      const profile = this.profileService.currentUserProfile();
      if (!profile) return;

      this.socketChat!.onMessage((message) => {
        // Handle incoming messages (could add to conversation/messages)
        console.log('New message received:', message);
      });

      this.socketChat!.onConversations((data: ChatConversation[]) => {
        this.conversations.set(data);
        this.updateContacts();
      });

      this.socketChat!.getConversations(profile.id);
    };

    // Initial connect
    connect();

    // React to profile changes
    runInInjectionContext(this.injector, () => {
      const stopEffect = effect(() => {
        const profile = this.profileService.currentUserProfile();
        if (profile) {
          connect();
          stopEffect.destroy();
        }
      });
    });
  }

  async updateContacts() {
    const conversations = this.conversations();
    const participantIds = new Set<string>();
    conversations.forEach((conv) =>
      conv.participants.forEach((id) => participantIds.add(id))
    );

    const currentUser = this.profileService.currentUserProfile();
    if (!currentUser) {
      this.contacts.set([]);
      return;
    }
    participantIds.delete(currentUser.id);

    const ids = Array.from(participantIds);
    const contacts: ChatContact[] = (
      await Promise.all(
        ids.map(async (id) => {
          const profile = await firstValueFrom(
            this.profileService.getDisplayProfile(id)
          );
          return profile
            ? {
                id: profile.id,
                name: profile.profileName,
                avatarUrl:
                  profile.profilePic ||
                  'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
                lastMessage: '',
                lastMessageTime: new Date().toISOString(),
              }
            : null;
        })
      )
    ).filter((c): c is ChatContact => !!c);

    contacts.push({
      id: currentUser.id,
      name: currentUser.profileName,
      avatarUrl:
        currentUser.profilePic ||
        'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
    });

    this.contacts.set(contacts);
  }

  openChat(conversationId: string) {
    const open = new Set(this.openWindows());
    open.add(conversationId);
    this.openWindows.set(open);
    this.selectedConversation.set(conversationId);
  }

  closeChat(conversationId: string) {
    const open = new Set(this.openWindows());
    open.delete(conversationId);
    this.openWindows.set(open);
  }

  isWindowOpen(conversationId: string): boolean {
    return this.openWindows().has(conversationId);
  }

  windowStates = computed(() => {
    const conversations = this.conversations();
    const openWindows = this.openWindows();
    return conversations.reduce((obj, conv) => {
      obj[conv.id] = {
        windowState: openWindows.has(conv.id) ? 'popout' : 'hidden',
        conversation: conv,
      };
      return obj;
    }, {} as Record<string, { windowState: ChatWindowState; conversation: ChatConversation }>);
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

  handleNewMessage(content: string, conversationId: string) {
    const senderId = this.profileService.currentUserProfile()?.id || '';
    const newMessage: Partial<ChatMessage> = {
      content,
      senderId,
      conversationId,
      recipientId:
        this.windowStates()[conversationId]?.conversation.participants.filter(
          (x: string) => x !== senderId
        ) ?? [],
      timestamp: new Date(),
      type: 'chat',
    };
    this.postMessage(newMessage);

    // Optimistically update conversation
    this.conversations.update((currentConversations) => {
      const idx = currentConversations.findIndex(
        (c) => c.id === conversationId
      );
      if (idx > -1) {
        const updatedConv = { ...currentConversations[idx] };
        updatedConv.messages = [
          ...updatedConv.messages,
          { ...newMessage, id: 'pending' } as ChatMessage,
        ];
        const newConvs = [...currentConversations];
        newConvs[idx] = updatedConv;
        return newConvs;
      }
      return currentConversations;
    });
  }

  postMessage(message: Partial<ChatMessage>) {
    if (this.socketChat) {
      this.socketChat.sendMessage(message);
      console.log('Message sent:', message);
    } else {
      this.messageService.addMessage({
        content: 'SocketChatService is not initialized.',
        type: 'error',
      });
    }
  }
}
