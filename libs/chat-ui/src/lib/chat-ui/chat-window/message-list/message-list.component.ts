import { Component, Input } from '@angular/core';

import { ChatContact } from '../../chat-ui.component';
import { ChatMessage } from '../../../types/message';

import { marked } from 'marked';

@Component({
  selector: 'lib-message-list',
  imports: [],
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


  getMessageHtml(content: string){
    return marked.parse(content);
  }
  /**
   * Gets the contact information for a given sender ID.
   * @param senderId The ID of the sender.
   * @returns The contact information for the sender, or undefined if not found.
   */
  getContact(senderId: string): ChatContact | undefined {
    return this.contacts.find(c => c.id === senderId);
  }
}
