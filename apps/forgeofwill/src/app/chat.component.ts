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
  OnInit,
  OnDestroy,
  Input,
  SimpleChange,
  SimpleChanges, OnChanges,
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
  SOCKET_AUTH_TOKEN_PROVIDER,
  SOCKET_AUTH_ERROR_HANDLER,
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
    SocketChatService,
    // {
    //   provide: SocketChatService,
    //   useFactory: (
    //     platformId: object,
    //     socketHost: string,
    //     socketNamespace: string,
    //     socketIoInstance: typeof io,
    //     authTokenProvider?: () => string | null,
    //     authErrorHandler?: () => void
    //   ) =>
    //     isPlatformBrowser(platformId)
    //       ? new SocketChatService(
    //         socketHost,
    //         socketNamespace,
    //         socketIoInstance,
    //         authTokenProvider,
    //         authErrorHandler
    //       )
    //       : null,
    //   deps: [
    //     PLATFORM_ID,
    //     SOCKET_HOST,
    //     SOCKET_NAMESPACE,
    //     SOCKET_IO_INSTANCE,
    //     SOCKET_AUTH_TOKEN_PROVIDER,
    //     SOCKET_AUTH_ERROR_HANDLER,
    //   ],
    // },
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy, OnChanges {
  @Input() externalMessages: Partial<ChatMessage>[] = [];
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

  // AI status tracking
  aiRespondingStatus = signal<{ [conversationId: string]: boolean }>({});
  aiThinkingMessages = signal<{ [conversationId: string]: string | null }>({});
  toolCallStatus = signal<{ [conversationId: string]: { toolName: string; status: string; attempt?: number } }>({});
  streamingMessages = signal<{ [conversationId: string]: string }>({});

  private platformId = inject(PLATFORM_ID);
  private profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);

  constructor() {
    this.socketChat = inject(SocketChatService, { optional: true });
    console.log(
      'ChatComponent initialized with SocketChatService:',
      this.socketChat
    );
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId) || !this.socketChat) {
      console.warn(
        'Chat component: Not in browser or socket service unavailable'
      );
      return;
    }

    // Restore open windows from localStorage
    this.restoreUIState();

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

    if (
      this.externalMessages.length > 0 &&
      isPlatformBrowser(this.platformId) &&
      this.socketChat
    ) {
      this.processExternalMessages(this.externalMessages);
    }
  }

  ngOnDestroy() {
    if (this.socketChat) {
      this.socketChat.destroy();
      console.log('Chat component destroyed, socket disconnected');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['externalMessages'] &&
      !changes['externalMessages'].isFirstChange()
    ) {
      this.processExternalMessages(changes['externalMessages'].currentValue);
    }
  }

  processExternalMessages(messages: Partial<ChatMessage>[]) {
    if (!this.socketChat) {
      console.error('SocketChatService is not available to process messages.');
      return;
    }

    messages.forEach((message) => {
      this.socketChat!.sendMessage(message);
      console.log('External message sent:', message);
    });
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
      if (JSON.stringify(this.conversations()) === JSON.stringify(data)) return;
      this.conversations.set(data);
      this.updateContacts();
    });

    // Set up AI status handler
    this.socketChat.onAIStatusUpdate((data) => {
      console.log('AI status update:', data);
      this.handleAIStatusUpdate(data);
    });

    // Set up tool call handler
    this.socketChat.onToolCallUpdate((data) => {
      console.log('Tool call update:', data);
      this.handleToolCallUpdate(data);
    });

    // Set up streaming response handler
    this.socketChat.onStreamingResponse((data) => {
      console.log('Streaming response:', data);
      this.handleStreamingResponse(data);
    });

    // Set up active streams handler (for reconnection)
    this.socketChat.onActiveStreams((streams) => {
      console.log('Active streams on reconnect:', streams);
      this.handleActiveStreams(streams);
    });

    // Set up reconnection handler
    this.socketChat.onReconnect(() => {
      console.log('Socket reconnected, requesting current state');
      const profile = this.profileService.currentUserProfile();
      if (profile) {
        this.socketChat?.requestReconnect(profile.id);
      }
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
   * Handle AI status updates
   */
  private handleAIStatusUpdate(data: { conversationId: string, status: 'thinking' | 'responding' | 'complete' | 'error', message?: string }) {
    const currentStatus = this.aiRespondingStatus();
    const currentThinking = this.aiThinkingMessages();

    switch (data.status) {
      case 'thinking':
        this.aiRespondingStatus.set({ ...currentStatus, [data.conversationId]: true });
        this.aiThinkingMessages.set({ ...currentThinking, [data.conversationId]: data.message || 'AI is thinking...' });
        break;
      case 'responding':
        this.aiThinkingMessages.set({ ...currentThinking, [data.conversationId]: null });
        this.aiRespondingStatus.set({ ...currentStatus, [data.conversationId]: true });
        break;
      case 'complete':
        this.aiRespondingStatus.set({ ...currentStatus, [data.conversationId]: false });
        this.aiThinkingMessages.set({ ...currentThinking, [data.conversationId]: null });
        break;
      case 'error':
        this.aiRespondingStatus.set({ ...currentStatus, [data.conversationId]: false });
        this.aiThinkingMessages.set({ ...currentThinking, [data.conversationId]: `Error: ${data.message || 'Unknown error occurred'}` });
        // Clear error message after 5 seconds
        setTimeout(() => {
          const current = this.aiThinkingMessages();
          this.aiThinkingMessages.set({ ...current, [data.conversationId]: null });
        }, 5000);
        break;
    }
  }

  /**
   * Handle tool call updates
   */
  private handleToolCallUpdate(data: { conversationId: string, toolName: string, status: 'calling' | 'success' | 'error' | 'retrying', error?: string, attempt?: number }) {
    const currentStatus = this.toolCallStatus();
    const currentThinking = this.aiThinkingMessages();

    this.toolCallStatus.set({
      ...currentStatus,
      [data.conversationId]: {
        toolName: data.toolName,
        status: data.status,
        attempt: data.attempt
      }
    });

    switch (data.status) {
      case 'calling':
        this.aiThinkingMessages.set({
          ...currentThinking,
          [data.conversationId]: `Calling ${data.toolName}...`
        });
        break;
      case 'retrying':
        this.aiThinkingMessages.set({
          ...currentThinking,
          [data.conversationId]: `Retrying ${data.toolName}... (attempt ${data.attempt || 1})`
        });
        break;
      case 'error':
        this.aiThinkingMessages.set({
          ...currentThinking,
          [data.conversationId]: `Tool error: ${data.error || `Failed to call ${data.toolName}`}`
        });
        break;
      case 'success':
        this.aiThinkingMessages.set({
          ...currentThinking,
          [data.conversationId]: null
        });
        break;
    }
  }

  /**
   * Handle streaming AI responses
   */
  private handleStreamingResponse(data: { conversationId: string, chunk: string, isComplete: boolean }) {
    const currentStreaming = this.streamingMessages();

    if (data.isComplete) {
      // Clear streaming state
      this.streamingMessages.set({ ...currentStreaming, [data.conversationId]: '' });
      const currentStatus = this.aiRespondingStatus();
      this.aiRespondingStatus.set({ ...currentStatus, [data.conversationId]: false });

      // Refresh conversations to get final message
      const profile = this.profileService.currentUserProfile();
      if (profile && this.socketChat) {
        this.socketChat.getConversations(profile.id);
      }
    } else {
      // Append chunk to streaming message
      const current = currentStreaming[data.conversationId] || '';
      this.streamingMessages.set({
        ...currentStreaming,
        [data.conversationId]: current + data.chunk
      });
    }
  }

  /**
   * Get AI responding status for a conversation
   */
  isAIResponding(conversationId: string): boolean {
    return this.aiRespondingStatus()[conversationId] || false;
  }

  /**
   * Get AI thinking message for a conversation
   */
  getAIThinkingMessage(conversationId: string): string | null {
    return this.aiThinkingMessages()[conversationId] || null;
  }

  /**
   * Get streaming message content for a conversation
   */
  getStreamingMessage(conversationId: string): string | null {
    return this.streamingMessages()[conversationId] || null;
  }

  /**
   * Handle active streams notification on reconnect
   */
  private handleActiveStreams(streams: Array<{ conversationId: string; status: string; lastUpdate: Date }>) {
    console.log('Handling active streams:', streams);

    streams.forEach(stream => {
      const currentStatus = this.aiRespondingStatus();
      this.aiRespondingStatus.set({
        ...currentStatus,
        [stream.conversationId]: true
      });

      const currentThinking = this.aiThinkingMessages();
      this.aiThinkingMessages.set({
        ...currentThinking,
        [stream.conversationId]: stream.status === 'thinking'
          ? 'AI is processing your message...'
          : 'AI is responding...'
      });
    });
  }

  /**
   * Restore UI state from localStorage
   */
  private restoreUIState() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const savedOpenWindows = localStorage.getItem('chat_open_windows');
      if (savedOpenWindows) {
        const openWindowIds = JSON.parse(savedOpenWindows) as string[];
        this.openWindows.set(new Set(openWindowIds));
        console.log('Restored open windows:', openWindowIds);
      }
    } catch (error) {
      console.error('Error restoring UI state:', error);
    }
  }

  /**
   * Save UI state to localStorage
   */
  private saveUIState() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const openWindowIds = Array.from(this.openWindows());
      localStorage.setItem('chat_open_windows', JSON.stringify(openWindowIds));
    } catch (error) {
      console.error('Error saving UI state:', error);
    }
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
      console.log(
        'Opened existing persona conversation:',
        personaConversation.id
      );
    } else {
      this.messageService.addMessage({
        content: 'Creating new conversation with AI persona...',
        type: 'info',
      });
      console.log(
        'Persona conversation creation not yet implemented for:',
        personaId
      );

      this.socketChat?.sendInit(profile.id, personaId, 'forgeofwill');

      // this.socketChat?.sendMessage({
      //   content: 'Creating new AI assistant conversation...',
      //   type: 'system',
      //   senderId: profile.id,
      //   recipientId: [personaId],
      // });
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
      conv.participants.some(
        (p) => p.startsWith('ai-') || p.includes('assistant')
      )
    );

    if (aiConversation) {
      // Open existing AI conversation
      this.openChat(aiConversation.id);
      console.log(
        'Opened existing AI assistant conversation:',
        aiConversation.id
      );
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
    this.saveUIState();
  }

  closeChat(conversationId: string) {
    const open = new Set(this.openWindows());
    open.delete(conversationId);
    this.openWindows.set(open);
    this.saveUIState();
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
    this.saveUIState();
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
