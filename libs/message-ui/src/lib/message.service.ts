import { Injectable, signal } from '@angular/core';

import { MessageType } from './message.type';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages = signal<MessageType[]>([]);

  /**
   * How long a message stays before it takes itself away.
   *
   * Nothing ever removed a message except a click on its close button, so
   * every toast a session produced stayed on screen. Three decisions in a row
   * left three stacked over the panel that was being worked in, on top of a
   * "Login successful" from ten minutes earlier.
   *
   * Errors stay. A message telling somebody something did not happen is worth
   * more than the space it occupies, and it is the one they may need to read
   * twice.
   */
  private static readonly DISMISS_AFTER_MS = 6000;

  addMessage(message: MessageType) {
    this.messages.update((messages) => [...messages, message]);

    if (message.type === 'error') return;

    setTimeout(() => {
      this.messages.update((messages) =>
        messages.filter((existing) => existing !== message)
      );
    }, MessageService.DISMISS_AFTER_MS);
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
