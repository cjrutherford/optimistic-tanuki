import {
  Component,
  Inject,
  PLATFORM_ID,
  signal,
  computed,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
  effect, OnInit, OnDestroy,
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
export class ChatComponent implements OnInit, OnDestroy {
  socketChat?: SocketChatService | null;
  private injector = inject(EnvironmentInjector);
  private connectionInitialized = false;

  contacts = signal<ChatContact[]>([]);
  conversations = signal<ChatConversation[]>([], {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  openWindows = signal<Set<string>>(new Set());
  selectedConversation = signal<string | null>(null);
  isConnected = signal<boolean>(false);

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
    if (!isPlatformBrowser(this.platformId) || !this.socketChat) {
      console.warn('Chat component: Not in browser or socket service unavailable');
      return;
    }

    this.initializeSocketConnection();

    // React to profile changes
    runInInjectionContext(this.injector, () => {
      const stopEffect = effect(() => {
        const profile = this.profileService.currentUserProfile();
        if (profile && !this.connectionInitialized) {
          this.connectToChat(profile.id);
          stopEffect.destroy();
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.socketChat) {
      this.socketChat.destroy();
      console.log('Chat component destroyed, socket disconnected');
    }
  }

  /**
   * Initialize socket connection event handlers
   */
  private initializeSocketConnection() {
    if (!this.socketChat) return;

    // Set up message handler
    this.socketChat.onMessage((message) => {
      console.log('New message received:', message);
      this.handleIncomingMessage(message);
    });

    // Set up conversations handler
    this.socketChat.onConversations((data: ChatConversation[]) => {
      console.log('Conversations updated:', data.length);
      this.conversations.set(data);
      this.updateContacts();
    });

    console.log('Socket connection handlers initialized');
  }

  /**
   * Connect to chat service and load conversations
   */
  private async connectToChat(profileId: string) {
    if (!this.socketChat || this.connectionInitialized) return;

    try {
      this.socketChat.getConversations(profileId);
      this.connectionInitialized = true;
      this.isConnected.set(true);
      console.log('Connected to chat service for profile:', profileId);
    } catch (error) {
      console.error('Error connecting to chat:', error);
      this.messageService.addMessage({
        content: 'Failed to connect to chat service',
        type: 'error',
      });
    }
  }

  /**
   * Handle incoming chat messages
   */
  private handleIncomingMessage(message: ChatMessage) {
    // Update the conversation with the new message
    this.conversations.update((conversations) => {
      const convIndex = conversations.findIndex(
        (c) => c.id === message.conversationId
      );
      if (convIndex > -1) {
        const updatedConv = { ...conversations[convIndex] };
        updatedConv.messages = [...updatedConv.messages, message];
        const newConversations = [...conversations];
        newConversations[convIndex] = updatedConv;
        return newConversations;
      }
      return conversations;
    });
  }

  /**
   * Open or create AI assistant conversation for a specific persona
   */
  async openOrCreatePersonaChat(personaId: string) {
    const profile = this.profileService.currentUserProfile();
    if (!profile) {
      this.messageService.addMessage({
        content: 'Please log in to chat with AI assistant',
        type: 'warning',
      });
      return;
    }

    // Look for existing conversation with this persona
    const personaConversation = this.conversations().find((conv) =>
      conv.participants.includes(personaId)
    );

    if (personaConversation) {
      // Open existing conversation
      this.openChat(personaConversation.id);
      console.log('Opened existing persona conversation:', personaConversation.id);
    } else {
      // TODO: Create new conversation with the persona
      this.messageService.addMessage({
        content: 'Creating new conversation with AI persona...',
        type: 'info',
      });
      console.log('Persona conversation creation not yet implemented for:', personaId);
    }
  }

  /**
   * Open or create AI assistant conversation (legacy method for backward compatibility)
   */
  async openAiAssistantChat() {
    const profile = this.profileService.currentUserProfile();
    if (!profile) {
      this.messageService.addMessage({
        content: 'Please log in to chat with AI assistant',
        type: 'warning',
      });
      return;
    }

    // Look for existing AI assistant conversation
    const aiConversation = this.conversations().find((conv) =>
      conv.participants.some((p) => p.startsWith('ai-') || p.includes('assistant'))
    );

    if (aiConversation) {
      // Open existing AI conversation
      this.openChat(aiConversation.id);
      console.log('Opened existing AI assistant conversation:', aiConversation.id);
    } else {
      // TODO: Create new AI assistant conversation
      this.messageService.addMessage({
        content: 'Creating new AI assistant conversation...',
        type: 'info',
      });
      console.log('AI assistant conversation creation not yet implemented');
    }
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
