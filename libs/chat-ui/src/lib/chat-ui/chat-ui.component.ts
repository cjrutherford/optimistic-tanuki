import { Component, signal } from '@angular/core';

import { ChatWindowComponent } from './chat-window/chat-window.component';
import { CommonModule } from '@angular/common';
import { ContactBubbleComponent } from './contact-bubble/contact-bubble.component';

@Component({
  selector: 'lib-chat-ui',
  imports: [CommonModule, ChatWindowComponent, ContactBubbleComponent],
  templateUrl: './chat-ui.component.html',
  styleUrl: './chat-ui.component.scss',
})
export class ChatUiComponent {
  contacts = [{
    id: 1,
    name: 'Johnathon Doe',
    avatarUrl: 'https://placehold.co/60x60',
    lastMessage: 'Hello, how are you?',
    lastMessageTime: '2023-10-01T12:00:00Z',
  }, {
    id: 2,
    name: 'Jane Smith',
    avatarUrl: 'https://placehold.co/60x60',
    lastMessage: 'Are we still on for the meeting?',
    lastMessageTime: '2023-10-01T12:05:00Z',
  }];
  selectedContact = signal<any>(null);
  showModal = signal<boolean>(false);

  onContactClick(contact: any) {
    const currentContact = this.selectedContact(); 
    if (currentContact && currentContact.id === contact.id) {
      this.closeChatWindow();
      return;
    }
    this.showModal.set(true);
    this.selectedContact.set(contact);
  }

  closeChatWindow() {
    this.showModal.set(false);
    this.selectedContact.set(null);
  }
}
