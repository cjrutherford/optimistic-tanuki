import { Injectable, signal } from '@angular/core';

import { MessageType } from './message/message.component';

@Injectable({
  providedIn: 'root'
})
/**
 * Service for managing and displaying messages.
 */
@Injectable({
  providedIn: 'root'
})
export class MessageService {
  /**
   * A signal that holds the array of messages.
   */
  messages = signal<MessageType[]>([]);

  /**
   * Adds a new message to the list.
   * @param message The message to add.
   */
  addMessage(message: MessageType) {
    this.messages.update((messages) => [...messages, message]);
  }

  /**
   * Clears all messages from the list.
   */
  clearMessages() {
    this.messages.update(() => []);
  }

  /**
   * Dismisses a message at the specified index.
   * @param index The index of the message to dismiss.
   */
  dismiss(index: number) {
    const currentMessages = this.messages();
    // Ensure index is within bounds
    if (index >= 0 && index < currentMessages.length) {
      currentMessages.splice(index, 1);
      this.messages.update(() => [...currentMessages]);
    }
  }
}
