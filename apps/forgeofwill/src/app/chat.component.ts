import { Component, inject, Inject, PLATFORM_ID, signal, computed, Signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { 
  ChatContact, 
  ChatMessage, 
  SocketChatService, 
  ChatWindowComponent, 
  ChatWindowState, 
  ChatConversation, 
  ContactBubbleComponent 
} from '@optimistic-tanuki/chat-ui';
import { ProfileService } from './profile/profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-chat',
  imports: [CommonModule, ChatWindowComponent, ContactBubbleComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  socketChat?: SocketChatService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private profileService: ProfileService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit() {

    if (isPlatformBrowser(this.platformId)) {
      this.socketChat = inject(SocketChatService);
      this.socketChat.onMessage((message) => {
        console.log('New message received:', message);
      });
      this.socketChat.onConversations((data: ChatConversation[]) => {
        console.log('Conversations update received:', data);
        this.conversations.set(data);
        this.updateContacts();
        this.computeWindowStates();
      });
      // this.socketChat.getConversations(this.profileService.currentUserProfile()!.id);
    }
  }

  openChat(conversationId: string) {
    const currentState = this.windowStates()[conversationId];
    if (currentState) {
      this.selectedConversation.set(conversationId);
      currentState.windowState = 'popout';
      console.log(`Opening chat for conversation ID: ${conversationId}`);
      this.windowStates.set({
        ...this.windowStates(),
        [conversationId]: currentState,
      });
    }
  }

  contacts = signal<ChatContact[]>([]);

  private async updateContacts() {
    const conversations = this.conversations();
    const participantIds = new Set<string>();
    conversations.forEach(conv => {
      conv.participants.forEach(id => participantIds.add(id));
    });

    // Remove current user's profile id from contacts
    const currentUserId = this.profileService.currentUserProfile()?.id;
    if (!currentUserId) {
      this.contacts.set([]);
      return;
    }
    participantIds.delete(currentUserId);

    // Convert participantIds to array and fetch profiles in parallel
    const ids = Array.from(participantIds);
    const contacts: ChatContact[] = (
      await Promise.all(
        ids.map(async id => {
          const profile = await firstValueFrom(this.profileService.getDisplayProfile(id));
          if (profile) {
            return {
              id: profile.id,
              name: profile.profileName,
              avatarUrl: profile.profilePic || 'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
              lastMessage: '',
              lastMessageTime: new Date().toISOString(),
            } as ChatContact;
          }
          return null;
        })
      )
    ).filter((c): c is ChatContact => !!c);
    this.contacts.set(contacts);
  }

  // Computed signal for window states as a Map
  windowStates = signal<Record<string, { windowState: ChatWindowState, conversation: ChatConversation }>>({});

  private computeWindowStates(): Record<string, { windowState: ChatWindowState, conversation: ChatConversation }> {
    const conversations = this.conversations();
    const obj: Record<string, { windowState: ChatWindowState, conversation: ChatConversation }> = {};
    const selectedConversationId = this.selectedConversation();
    conversations.forEach(conv => {
      const windowState: ChatWindowState = selectedConversationId && selectedConversationId === conv.id ? 'popout' : 'hidden';
      obj[conv.id] = {
        windowState,
        conversation: conv,
      };
    });
    return obj;
  }

  selectedConversation = signal<string | null>(null);
  conversations = signal<ChatConversation[]>([]); 

  getLoadedContacts(contactIds: string[]) {
    return this.contacts().filter(contact => contactIds.includes(contact.id));
  }

  handleWindowStateChange(conversationId: string, newState: ChatWindowState) {
    const currentState = this.windowStates()[conversationId];
    if (currentState) {
      currentState.windowState = newState;
      this.windowStates.set({
        ...this.windowStates(),
        [conversationId]: currentState,
      });
      console.log(`Window state for conversation ID ${conversationId} changed to ${newState}`);
    } else {
      console.warn(`No window state found for conversation ID ${conversationId}`);
    }
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
