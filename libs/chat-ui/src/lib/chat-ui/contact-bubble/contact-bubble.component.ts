import { Component, Input, signal } from '@angular/core';

import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

export interface Contact {
  id: string | number;
  name: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
}

@Component({
  selector: 'lib-contact-bubble',
  imports: [CommonModule, ButtonComponent, ProfilePhotoComponent],
  templateUrl: './contact-bubble.component.html',
  styleUrl: './contact-bubble.component.scss',
})
export class ContactBubbleComponent {
  @Input() contact: Contact = {
    id: 1,
    name: 'Johnathon Doe',
    avatarUrl: 'https://placehold.co/60x60',
    lastMessage: 'Nah, man, I think it\'s cool',
    lastMessageTime: '2023-10-01T12:00:00Z',
  };
  @Input() isSelected = false;
  showPopup = signal<boolean>(false);
}
