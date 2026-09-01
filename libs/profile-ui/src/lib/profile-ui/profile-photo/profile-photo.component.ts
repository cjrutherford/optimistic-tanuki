import { Component, Input, Output, EventEmitter } from '@angular/core';

import { avatarFor } from './generated-avatar';

@Component({
  selector: 'lib-profile-photo',
  standalone: true,
  imports: [],
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss',
})
export class ProfilePhotoComponent {
  @Input() src = '';
  @Input() alt = '';
  /**
   * Who this is, used to draw a picture when there is no photograph.
   *
   * Falls back to alt, which callers already set to "<name> avatar", so most
   * of them get a real avatar without changing anything.
   */
  @Input() name = '';
  @Input() size = 32;
  @Input() profileId = '';
  @Input() enableChat = false;
  @Output() startChat = new EventEmitter<string>();
  @Output() profileClick = new EventEmitter<void>();

  handleClick(event: Event) {
    if (this.enableChat && this.profileId) {
      this.startChat.emit(this.profileId);
    } else {
      this.profileClick.emit();
    }
  }

  /**
   * The picture to show when there is no photograph, drawn rather than
   * fetched. This used to be a link to placehold.co, which is an external
   * round trip for a grey rectangle and does not resolve at all in a container
   * with no route out.
   */
  get fallback(): string {
    return avatarFor(this.name || this.alt.replace(/\s+avatar$/i, ''));
  }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    // Guarded, because a fallback that also fails would loop on this handler.
    if (img.src.startsWith('data:')) return;
    img.src = this.fallback;
  }
}
