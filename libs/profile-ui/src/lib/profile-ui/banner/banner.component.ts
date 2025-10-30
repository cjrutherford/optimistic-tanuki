import { Component, Input } from '@angular/core';

import { ProfilePhotoComponent } from '../profile-photo/profile-photo.component';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-banner',
  standalone: true,
  imports: [ProfilePhotoComponent, CardComponent],
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
})
export class BannerComponent {
  @Input() profileName = '';
  @Input() profileImage = '';
  @Input() backgroundImage = '';

  // Fallback label if none provided (apps should pass the user's name from token)
  get displayName(): string {
    return this.profileName && this.profileName.trim().length
      ? this.profileName
      : 'Your Name';
  }

  // Provide a placeholder background image when none provided (keeps banner visual)
  get backgroundStyle(): string | null {
    return this.backgroundImage && this.backgroundImage.length
      ? `url('${this.backgroundImage}')`
      : null;
  }
}
