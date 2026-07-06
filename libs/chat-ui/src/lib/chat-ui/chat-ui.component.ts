import {
  ChatWindowComponent,
  ChatWindowState,
} from './chat-window/chat-window.component';
import {
  Component,
  HostListener,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  signal,
  OnInit,
  OnChanges,
} from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { EmptyStateComponent } from '@optimistic-tanuki/common-ui';

import { ChatConversation, ChatMessage } from '../types/message';

import { ContactBubbleComponent } from './contact-bubble/contact-bubble.component';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { constructConversation } from '../utils';

/**
 * Represents a chat contact.
 */
export declare type ChatContact = {
  /**
   * The unique identifier for the contact.
   */
  id: string;
  /**
   * The name of the contact.
   */
  name: string;
  /**
   * The URL of the contact's avatar.
   */
  avatarUrl?: string;
  /**
   * The URL of the contact's profile picture (from ProfileDto).
   */
  profilePic?: string;
  /**
   * The last message received from the contact.
   */
  lastMessage?: string;
  /**
   * The timestamp of the last message.
   */
  lastMessageTime?: string;
  /**
   * The presence status of the contact.
   */
  presence?: 'online' | 'offline' | 'away' | 'busy';
  /**
   * The last time the contact was seen (for offline users).
   */
  lastSeen?: Date;
};

/**
 * The main UI component for the chat interface.
 */
@Component({
  selector: 'lib-chat-ui',
  imports: [
    ContactBubbleComponent,
    ChatWindowComponent,
    DatePipe,
    NgIf,
    EmptyStateComponent,
  ],
  templateUrl: './chat-ui.component.html',
  styleUrl: './chat-ui.component.scss',
})
export class ChatUiComponent implements OnInit, OnChanges {
  isMobileViewport = signal(false);
  @Input() layout: 'floating' | 'embedded' = 'floating';
  /**
   * The list of chat contacts.
   */
  @Input() contacts: ChatContact[] = [
    {
      id: '1',
      name: 'Johnathon Doe',
      avatarUrl:
        'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
      lastMessage: 'Hello, how are you?',
      lastMessageTime: '2023-10-01T12:00:00Z',
    },
    {
      id: '2',
      name: 'Jane Smith',
      avatarUrl:
        'https://media.craiyon.com/2025-06-20/3ApXHEb8RxWE8eNQlfsjQg.webp',
      lastMessage: 'Are we still on for the meeting?',
      lastMessageTime: '2023-10-01T12:05:00Z',
    },
    {
      id: '3',
      name: 'System',
      avatarUrl:
        'https://media.craiyon.com/2025-07-07/sBlkvTPVSqy4sPVimqT8mg.webp',
      lastMessage:
        'Your password has been reset. If you did not request this, please contact support.',
      lastMessageTime: '2023-10-01T12:10:00Z',
    },
  ];

  /**
   * The list of chat conversations.
   */
  @Input() conversations: ChatConversation[] = [
    {
      id: '1',
      messages: [
        {
          id: '1',
          conversationId: '1',
          senderId: '1',
          recipientId: ['2'],
          content: 'Hello, how are you?',
          timestamp: new Date('2023-10-01T12:00:00Z'),
          type: 'chat',
        },
      ],
      participants: ['1', '2'],
      createdAt: new Date('2023-10-01T11:59:00Z'),
      updatedAt: new Date('2023-10-01T12:00:00Z'),
    },
    {
      id: '2',
      messages: [
        {
          id: '2',
          conversationId: '2',
          senderId: '2',
          recipientId: ['1'],
          content: 'Are we still on for the meeting?',
          timestamp: new Date('2023-10-01T12:05:00Z'),
          type: 'chat',
        },
      ],
      participants: ['1', '2'],
      createdAt: new Date('2023-10-01T12:05:00Z'),
      updatedAt: new Date('2023-10-01T12:05:00Z'),
    },
    {
      id: '3',
      messages: [
        {
          id: '3',
          conversationId: '3',
          senderId: '1',
          recipientId: ['2'],
          content:
            'Your password has been reset. If you did not request this, please contact support.',
          timestamp: new Date('2023-10-01T12:10:00Z'),
          type: 'system',
        },
      ],
      participants: ['1', '2'],
      createdAt: new Date('2023-10-01T12:10:00Z'),
      updatedAt: new Date('2023-10-01T12:10:00Z'),
    },
  ];
  @Input() currentUserId = '';
  @Output() messageSubmitted = new EventEmitter<{
    conversationId: string;
    content: string;
  }>();
  @Input() autoOpenFirstConversation = false;
  /**
   * A signal that holds the state of each chat window.
   */
  windowStates = signal<{
    [key: string]: {
      windowState: ChatWindowState;
      conversation: ChatConversation[];
    };
  }>({});
  /**
   * A signal that holds the currently selected contact.
   */
  selectedContact = signal(null);
  selectedConversationId = signal<string | null>(null);
  /**
   * A signal that determines whether the modal is shown.
   */
  showModal = signal(false);

  /**
   * The list of user profiles.
   */
  profiles: ProfileDto[] = [
    {
      id: '1',
      profileName: 'Johnathon Doe',
      profilePic:
        'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
      userId: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date(),
    },
    {
      id: '2',
      profileName: 'Jane Smith',
      profilePic:
        'https://media.craiyon.com/2025-06-20/3ApXHEb8RxWE8eNQlfsjQg.webp',
      userId: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date(),
    },
    {
      id: '3',
      profileName: 'System',
      profilePic:
        'https://media.craiyon.com/2025-07-07/sBlkvTPVSqy4sPVimqT8mg.webp',
      userId: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date(),
    },
  ];

  /**
   * Initializes the component and syncs the window states.
   */
  ngOnInit() {
    this.updateViewportState();
    this.syncWindowStates();
  }

  /**
   * Detects changes to the component's inputs and syncs the window states accordingly.
   * @param changes The changes to the component's inputs.
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['contacts'] || changes['conversations']) {
      this.syncWindowStates();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  /**
   * Synchronizes the window states with the contacts and conversations.
   */
  private syncWindowStates() {
    const currentStates = { ...this.windowStates() };
    this.contacts.forEach((contact) => {
      const conversation =
        this.conversations.filter((convo) => convo.id === contact.id) ||
        ([] as ChatConversation[]);

      if (!currentStates[contact.id]) {
        currentStates[contact.id] = {
          windowState: 'hidden',
          conversation: [...conversation] as ChatConversation[],
        };
      } else {
        currentStates[contact.id] = {
          ...currentStates[contact.id],
          conversation: [...conversation] as ChatConversation[],
        };
      }
    });

    if (this.autoOpenFirstConversation && this.contacts.length > 0) {
      const firstContactId = this.contacts[0].id;
      this.selectedConversationId.set(firstContactId);
      Object.keys(currentStates).forEach((contactId) => {
        currentStates[contactId].windowState =
          contactId === firstContactId ? this.activeWindowState() : 'hidden';
      });
    }

    this.windowStates.set(currentStates);
  }

  /**
   * Constructs a list of chat contacts from a list of profiles and messages.
   * @param contacts The list of user profiles.
   * @param messages The list of chat messages.
   * @returns A list of chat contacts.
   */
  getConversationContacts(
    contacts: ProfileDto[],
    messages: ChatMessage[]
  ): ChatContact[] {
    return constructConversation(contacts, messages);
  }
  /**
   * Opens a chat window for a given contact.
   * @param contactId The ID of the contact to open a chat with.
   */
  openChat(contactId: string) {
    const updatedStates = { ...this.windowStates() };
    Object.keys(updatedStates).forEach((id) => {
      updatedStates[id] = {
        ...updatedStates[id],
        windowState: id === contactId ? this.activeWindowState() : 'hidden',
      };
    });
    this.selectedConversationId.set(contactId);
    this.windowStates.set(updatedStates);
  }

  /**
   * Handles changes to the window state of a chat window.
   * @param contactId The ID of the contact whose window state has changed.
   * @param newState The new window state.
   */
  handleWindowStateChange(contactId: string, newState: ChatWindowState) {
    const currentState = this.windowStates()[contactId];
    if (currentState) {
      currentState.windowState = newState;
      this.windowStates.set({
        ...this.windowStates(),
        [contactId]: currentState,
      });
    }
  }

  handleMessageSubmitted(conversationId: string, content: string) {
    this.messageSubmitted.emit({ conversationId, content });
  }

  getConversation(contactId: string): ChatConversation {
    const state = this.windowStates()[contactId];
    if (state && state.conversation && state.conversation.length > 0) {
      return state.conversation[0];
    }
    return {
      id: '',
      participants: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  getMessagesForContact(contactId: string): ChatMessage[] {
    const conversation = this.getConversation(contactId);
    return conversation.messages || [];
  }

  activeWindowState(): ChatWindowState {
    return this.layout === 'embedded' ? 'embedded' : 'popout';
  }

  private updateViewportState(): void {
    if (typeof window === 'undefined') {
      this.isMobileViewport.set(false);
      return;
    }

    this.isMobileViewport.set(window.innerWidth <= 640);
  }
}
