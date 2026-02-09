import { Component, Input } from '@angular/core';
import { CommonModule, NgClass, NgIf, DatePipe } from '@angular/common';

import { ChatContact } from '../../chat-ui.component';
import { ChatMessage } from '../../../types/message';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

@Component({
  selector: 'lib-message-list',
  imports: [CommonModule, NgClass, NgIf, DatePipe, ProfilePhotoComponent],
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
/**
 * Displays a list of messages in a chat conversation.
 */
export class MessageListComponent {
  /**
   * The list of contacts in the chat.
   */
  @Input() contacts: ChatContact[] = [];
  /**
   * The list of messages in the conversation.
   */
  @Input() messages: ChatMessage[] = [];

  getMessageContent(content: string): string {
    // Strip HTML if needed
    return content.replace(/<[^>]*>?/gm, '');
  }

  getContact(senderId: string): ChatContact | undefined {
    return this.contacts.find((c) => c.id === senderId);
  }

  isReceived(senderId: string): boolean {
    // Assuming current user has a specific ID, here we'll check if it's not the current user
    return senderId !== 'current-user';
  }

  isSent(senderId: string): boolean {
    return senderId === 'current-user';
  }

  getMessageStatusClass(message: ChatMessage): string {
    // Simple status implementation
    if (message.type === 'system') {
      return 'status-system';
    }
    return 'status-delivered';
  }

  isFirstInGroup(messages: ChatMessage[], index: number): boolean {
    if (index === 0) return true;

    const currentSender = messages[index].senderId;
    const previousSender = messages[index - 1].senderId;

    return currentSender !== previousSender;
  }

  isLastInGroup(messages: ChatMessage[], index: number): boolean {
    if (index === messages.length - 1) return true;

    const currentSender = messages[index].senderId;
    const nextSender = messages[index + 1].senderId;

    return currentSender !== nextSender;
  }
}
