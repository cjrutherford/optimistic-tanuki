import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

@Component({
  selector: 'lib-contact-bubble',
  imports: [CommonModule, ButtonComponent, ProfilePhotoComponent],
  templateUrl: './contact-bubble.component.html',
  styleUrl: './contact-bubble.component.scss',
})
export class ContactBubbleComponent {
  @Input() contact: { name: string; avatarUrl: string; lastMessage: string; lastMessageTime: string } = {
    name: 'Johnathon Doe',
    avatarUrl: 'https://placehold.co/60x60',
    lastMessage: 'Nah, man, I think it\'s cool',
    lastMessageTime: '2023-10-01T12:00:00Z',
  };
  @Input() isSelected = false;
}
