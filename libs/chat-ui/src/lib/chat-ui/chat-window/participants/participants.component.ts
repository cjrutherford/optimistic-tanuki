import { Component, Input } from '@angular/core';

import { ChatContact } from '../../chat-ui.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-participants',
  imports: [CommonModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent {
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
