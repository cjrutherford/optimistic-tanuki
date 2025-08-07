import { Component, Input, signal } from '@angular/core';

import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { ChatContact } from '../chat-ui.component';

/**
 * Represents a contact with chat information.
 */
export interface Contact {
  /**
   * The unique identifier of the contact.
   */
  id: string | number;
  /**
   * The name of the contact.
   */
  name: string;
  /**
   * The URL of the contact's avatar.
   */
  avatarUrl: string;
  /**
   * The content of the last message from the contact.
   */
  lastMessage: string;
  /**
   * The timestamp of the last message from the contact.
   */
  lastMessageTime: string;
}

/**
 * Component for displaying a contact bubble with chat information.
 */
@Component({
  selector: 'lib-contact-bubble',
  imports: [CommonModule, ButtonComponent, ProfilePhotoComponent],
  templateUrl: './contact-bubble.component.html',
  styleUrl: './contact-bubble.component.scss',
})
export class ContactBubbleComponent {

  /**
   * The contact data to display.
   */
  @Input() contacts: ChatContact[] = [
    {
      id: '1',
      name: 'Johnathon Doe',
      avatarUrl: 'https://placehold.co/60x60',
      lastMessage: "Nah, man, I think it's cool",
      lastMessageTime: '2023-10-01T12:00:00Z',
    },
  ];

  /**
   * Indicates whether the contact bubble is selected.
   */
  @Input() isSelected = false;

  /**
   * Signal to control the visibility of a popup.
   */
  showPopup = signal<boolean>(false);
}
