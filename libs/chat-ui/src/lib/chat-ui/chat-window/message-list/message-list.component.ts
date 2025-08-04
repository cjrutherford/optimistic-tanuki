import { Component, Input } from '@angular/core';

import { ChatContact } from '../../chat-ui.component';
import { ChatMessage } from '../../../types/message';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-message-list',
  imports: [CommonModule],
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
export class MessageListComponent {
  @Input() contacts: ChatContact[] = [];
  @Input() messages: ChatMessage[] = [];

  getContact(senderId: string): ChatContact | undefined {
    return this.contacts.find(c => c.id === senderId);
  }
}
