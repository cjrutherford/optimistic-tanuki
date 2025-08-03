import { Injectable, signal } from '@angular/core';

import { MessageType } from './message/message.component';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  messages = signal<MessageType[]>([]);

  addMessage(message: MessageType) {
    this.messages.update((messages) => [...messages, message]);
  }

  clearMessages() {
    this.messages.update(() => []);
  }

  dismiss(index: number) {
    const currentMessages = this.messages();
    // Ensure index is within bounds
    if (index >= 0 && index < currentMessages.length) {
      currentMessages.splice(index, 1);
      this.messages.update(() => [...currentMessages]);
    }
  }
}
