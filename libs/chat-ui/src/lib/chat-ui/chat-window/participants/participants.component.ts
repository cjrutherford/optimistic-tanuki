import { Component, Input } from '@angular/core';

import { ChatContact } from '../../chat-ui.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-participants',
  imports: [CommonModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
/**
 * Component for displaying a list of chat participants.
 */
export class ParticipantsComponent {
  /**
   * The list of participants in the chat.
   */
  @Input() participants: ChatContact[] = [
    {
      id: '1', name: 'Alice', avatarUrl: 'https://placehold.co/60x60',
      lastMessage: '',
      lastMessageTime: ''
    },
    {
      id: '2', name: 'Bob', avatarUrl: 'https://placehold.co/60x60',
      lastMessage: '',
      lastMessageTime: ''
    }
  ];
}
