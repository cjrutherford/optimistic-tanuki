import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgClass, NgIf, DatePipe } from '@angular/common';

import { ChatContact } from '../../chat-ui.component';
import { ChatMessage, MessageReaction } from '../../../types/message';
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
  /**
   * Current user ID for determining sent/received messages.
   */
  @Input() currentUserId: string = '';
  /**
   * IDs of users currently typing in this conversation.
   */
  @Input() typingUsers: string[] = [];
  /**
   * Emitted when a reaction is added to a message.
   */
  @Output() reactionAdded = new EventEmitter<{
    messageId: string;
    emoji: string;
  }>();
  /**
   * Emitted when a reaction is removed from a message.
   */
  @Output() reactionRemoved = new EventEmitter<{
    messageId: string;
    emoji: string;
  }>();

  /**
   * Common emoji reactions that can be added.
   */
  commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

  /**
   * Whether the emoji picker is currently shown.
   */
  showEmojiPicker: { [messageId: string]: boolean } = {};

  getMessageContent(content: string): string {
    // Strip HTML if needed
    return content.replace(/<[^>]*>?/gm, '');
  }

  getContact(senderId: string): ChatContact | undefined {
    return this.contacts.find((c) => c.id === senderId);
  }

  isReceived(senderId: string): boolean {
    return senderId !== this.currentUserId;
  }

  isSent(senderId: string): boolean {
    return senderId === this.currentUserId;
  }

  isReadBy(message: ChatMessage, contactId: string): boolean {
    return message.readBy?.includes(contactId) || false;
  }

  getMessageStatusClass(message: ChatMessage): string {
    if (message.type === 'system') {
      return 'status-system';
    }
    if (message.isDeleted) {
      return 'status-deleted';
    }
    if (
      this.isSent(message.senderId) &&
      message.readBy &&
      message.readBy.length > 0
    ) {
      return 'status-read';
    }
    if (this.isSent(message.senderId)) {
      return 'status-sent';
    }
    return 'status-delivered';
  }

  hasReactions(message: ChatMessage): boolean {
    return !!(message.reactions && message.reactions.length > 0);
  }

  getReactionsByEmoji(
    message: ChatMessage
  ): { emoji: string; count: number; users: string[]; isActive: boolean }[] {
    if (!message.reactions) return [];

    const reactionMap = new Map<string, string[]>();
    message.reactions.forEach((r) => {
      const users = reactionMap.get(r.emoji) || [];
      users.push(r.userId);
      reactionMap.set(r.emoji, users);
    });

    return Array.from(reactionMap.entries()).map(([emoji, users]) => ({
      emoji,
      count: users.length,
      users,
      isActive: users.includes(this.currentUserId),
    }));
  }

  toggleEmojiPicker(messageId: string) {
    this.showEmojiPicker[messageId] = !this.showEmojiPicker[messageId];
  }

  addReaction(messageId: string, emoji: string) {
    this.reactionAdded.emit({ messageId, emoji });
    this.showEmojiPicker[messageId] = false;
  }

  removeReaction(messageId: string, emoji: string) {
    this.reactionRemoved.emit({ messageId, emoji });
  }

  getContactName(userId: string): string {
    const contact = this.contacts.find((c) => c.id === userId);
    return contact?.name || 'Unknown';
  }

  isTyping(userId: string): boolean {
    return this.typingUsers.includes(userId);
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
