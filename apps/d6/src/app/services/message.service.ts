import { Injectable, signal } from '@angular/core';

export interface MessageType {
  content: string;
  type: 'info' | 'error' | 'success';
  id?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private messageIdCounter = 0;
  private _messages = signal<MessageType[]>([]);

  messages = this._messages.asReadonly();

  addMessage(message: Omit<MessageType, 'id'>): number {
    const id = ++this.messageIdCounter;
    const newMessage = { ...message, id };
    this._messages.update((messages) => [...messages, newMessage]);
    return id;
  }

  success(content: string): number {
    return this.addMessage({ content, type: 'success' });
  }

  error(content: string): number {
    return this.addMessage({ content, type: 'error' });
  }

  info(content: string): number {
    return this.addMessage({ content, type: 'info' });
  }

  removeMessage(id: number): void {
    this._messages.update((messages) =>
      messages.filter((m) => m.id !== id)
    );
  }

  clearMessages(): void {
    this._messages.set([]);
  }

  dismiss(index: number): void {
    const currentMessages = this._messages();
    if (index >= 0 && index < currentMessages.length) {
      const messageId = currentMessages[index].id;
      if (messageId !== undefined) {
        this.removeMessage(messageId);
      }
    }
  }
}
