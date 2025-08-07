import { ButtonComponent, CardComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { MessageService } from '../message.service';

/**
 * Represents a message with content and type.
 */
export declare type MessageType = {
  /**
   * The content of the message.
   */
  content: string;
  /**
   * The type of the message (info, warning, error, or success).
   */
  type: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Component for displaying messages.
 */
@Component({
  selector: 'lib-message',
  imports: [CommonModule, CardComponent, TileComponent, ButtonComponent],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss',
})
export class MessageComponent {
  /**
   * The MessageService instance.
   */
  messageService: MessageService;
  /**
   * Creates an instance of MessageComponent.
   * @param _messageService The MessageService instance to inject.
   */
  constructor(_messageService: MessageService) {
    this.messageService = _messageService;
  }

  /**
   * Dismisses a message at the specified index.
   * @param index The index of the message to dismiss.
   */
  dismissMessage(index: number) {
    console.log('Dismissing message at index:', index);
    this.messageService.dismiss(index);
  }

  /**
   * Clears all messages.
   */
  clearAll() {
    console.log('Clearing all messages');
    this.messageService.clearMessages();
  }
}
