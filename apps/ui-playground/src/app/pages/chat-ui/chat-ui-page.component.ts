import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ChatWindowComponent,
  ContactBubbleComponent,
  type ChatConversation,
  type ChatContact,
} from '@optimistic-tanuki/chat-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-chat-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    ChatWindowComponent,
    ContactBubbleComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/chat-ui"
      title="Chat UI"
      description="Contact and conversation primitives for embedded messaging workflows."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('contact-bubble') {
        <div class="preview-padded">
          <lib-contact-bubble [contacts]="contacts" />
        </div>
        } @case ('chat-window') {
        <div class="preview-padded">
          <lib-chat-window
            [contact]="contacts"
            [messages]="conversation"
            [currentUserId]="'demo-user'"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatUiPageComponent {
  readonly importSnippet = `import { ContactBubbleComponent, ChatWindowComponent } from '@optimistic-tanuki/chat-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly contacts: ChatContact[] = [
    {
      id: 'peer-profile',
      name: 'Mika Vale',
      avatarUrl: 'https://placehold.co/96x96/334155/e2e8f0?text=MV',
      lastMessage: 'Can we add a discovery page after the workflow set?',
      lastMessageTime: '2026-04-03T14:05:00Z',
    },
  ];
  readonly conversation: ChatConversation = {
    id: 'conversation-1',
    participants: ['demo-user', 'peer-profile'],
    messages: [
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'peer-profile',
        recipientId: ['demo-user'],
        content: 'Can we add a discovery page after the workflow set?',
        timestamp: new Date('2026-04-03T14:05:00Z'),
        type: 'chat',
      },
      {
        id: 'message-2',
        conversationId: 'conversation-1',
        senderId: 'demo-user',
        recipientId: ['peer-profile'],
        content: 'Yes. Search and persona are in the next wave.',
        timestamp: new Date('2026-04-03T14:07:00Z'),
        type: 'chat',
      },
    ],
    createdAt: new Date('2026-04-03T14:00:00Z'),
    updatedAt: new Date('2026-04-03T14:07:00Z'),
  };
  readonly elements: PlaygroundElement[] = [
    {
      id: 'contact-bubble',
      title: 'Contact Bubble',
      headline: 'Conversation roster row',
      importName: 'ContactBubbleComponent',
      selector: 'lib-contact-bubble',
      summary: 'Compact conversation preview surface with avatar and recency.',
      props: [],
    },
    {
      id: 'chat-window',
      title: 'Chat Window',
      headline: 'Embedded conversation surface',
      importName: 'ChatWindowComponent',
      selector: 'lib-chat-window',
      summary: 'Expanded messaging window with participant context and threaded messages.',
      props: [],
    },
  ];

  constructor() {
    for (const element of this.elements) {
      this.configs[element.id] = {};
    }
  }
}
