import {
  ButtonComponent,
  CardComponent,
  TileComponent,
} from '@optimistic-tanuki/common-ui';
import { Component, Input, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { MessageService } from '../message.service';

@Component({
  selector: 'lib-message',
  imports: [CommonModule, CardComponent, TileComponent, ButtonComponent],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss',
})
export class MessageComponent {
  messageService: MessageService;
  constructor() {
    const _messageService = inject(MessageService);

    this.messageService = _messageService;
  }

  dismissMessage(index: number) {
    console.log('Dismissing message at index:', index);
    this.messageService.dismiss(index);
  }

  clearAll() {
    console.log('Clearing all messages');
    this.messageService.clearMessages();
  }
}
