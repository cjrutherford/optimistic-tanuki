import { ChatWindowComponent, ChatWindowState } from './chat-window/chat-window.component';
import { Component, Input, SimpleChanges, computed, signal } from '@angular/core';

import { ChatConversation, ChatMessage } from '../types/message';
import { CommonModule } from '@angular/common';
import { ContactBubbleComponent } from './contact-bubble/contact-bubble.component';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { constructConversation } from '../utils';

export declare type ChatContact = {
  id: string;
  name: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
}

@Component({
  selector: 'lib-chat-ui',
  imports: [CommonModule, ChatWindowComponent, ContactBubbleComponent],
  templateUrl: './chat-ui.component.html',
  styleUrl: './chat-ui.component.scss',
})
export class ChatUiComponent {
  @Input() contacts: ChatContact[] = [{
    id: '1',
    name: 'Johnathon Doe',
    avatarUrl: 'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
    lastMessage: 'Hello, how are you?',
    lastMessageTime: '2023-10-01T12:00:00Z',
  }, {
    id: '2',
    name: 'Jane Smith',
    avatarUrl: 'https://media.craiyon.com/2025-06-20/3ApXHEb8RxWE8eNQlfsjQg.webp',
    lastMessage: 'Are we still on for the meeting?',
    lastMessageTime: '2023-10-01T12:05:00Z',
  }, {
    id: '3',
    name: 'System',
    avatarUrl: 'https://media.craiyon.com/2025-07-07/sBlkvTPVSqy4sPVimqT8mg.webp',
    lastMessage: 'Your password has been reset. If you did not request this, please contact support.',
    lastMessageTime: '2023-10-01T12:10:00Z',
  }];

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
          type: 'chat'
        },
      ],
      participants: ['1', '2'],
      createdAt: new Date('2023-10-01T11:59:00Z'),
      updatedAt: new Date('2023-10-01T12:00:00Z')
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
          type: 'chat'
        },
      ],
      participants: [ '1', '2' ],
      createdAt: new Date('2023-10-01T12:05:00Z'),
      updatedAt: new Date('2023-10-01T12:05:00Z')
    },
    {
      id: '3',
      messages: [
        {
          id: '3',
          conversationId: '3',
          senderId: '1',
          recipientId: ['2'],
          content: 'Your password has been reset. If you did not request this, please contact support.',
          timestamp: new Date('2023-10-01T12:10:00Z'),
          type: 'system'
        }
      ],
      participants: ['1', '2'],
      createdAt: new Date('2023-10-01T12:10:00Z'),
      updatedAt: new Date('2023-10-01T12:10:00Z')
    }
  ];
  windowStates = signal<{ [key: string]: { windowState: ChatWindowState, conversation: ChatConversation[] } }>({});
  selectedContact = signal<ChatContact | null>(null);
  showModal = signal<boolean>(false);

  profiles: ProfileDto[] = [
    {
      id: '1',
      profileName: 'Johnathon Doe',
      profilePic: 'https://pics.craiyon.com/2023-12-02/m-ncT7EvSXypl0qgvzXhWA.webp',
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
      profilePic: 'https://media.craiyon.com/2025-06-20/3ApXHEb8RxWE8eNQlfsjQg.webp',
      userId: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date()
    },
    {
      id: '3',
      profileName: 'System',
      profilePic: 'https://media.craiyon.com/2025-07-07/sBlkvTPVSqy4sPVimqT8mg.webp',
      userId: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date()
    }
  ];

  ngOnInit(){
    this.syncWindowStates();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['contacts'] || changes['conversations']) {
      this.syncWindowStates();
    } 
  }

  private syncWindowStates() {
    const currentStates = this.windowStates();
    this.contacts.forEach(contact => {
      if (!currentStates[contact.id]) {
        const conversation = this.conversations.filter(convo => convo.id === contact.id) || [] as ChatConversation[];
        currentStates[contact.id] = { windowState: 'hidden', conversation: [...conversation] as ChatConversation[] };
      }
    });
    this.windowStates.set(currentStates);
  }

  getConversationContacts(contacts: ProfileDto[], messages: ChatMessage[]): ChatContact[] {
    return constructConversation(contacts, messages);
  }
  openChat(contactId: string) {
    const currentState = this.windowStates()[contactId];
    if (currentState) {
      currentState.windowState = 'popout';
      this.windowStates.set({ ...this.windowStates(), [contactId]: currentState });
      return;
    }
  }

  handleWindowStateChange(contactId: string, newState: ChatWindowState) {
    const currentState = this.windowStates()[contactId];
    if (currentState) {
      currentState.windowState = newState;
      this.windowStates.set({ ...this.windowStates(), [contactId]: currentState });
    }
  }
}
