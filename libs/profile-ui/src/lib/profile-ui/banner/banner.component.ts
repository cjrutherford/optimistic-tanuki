import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfilePhotoComponent } from '../profile-photo/profile-photo.component';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-banner',
  standalone: true,
  imports: [CommonModule, ProfilePhotoComponent, CardComponent],
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
})
/**
 * Component for displaying a user profile banner.
 */
@Component({
  selector: 'lib-banner',
  standalone: true,
  imports: [CommonModule, ProfilePhotoComponent, CardComponent],
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
})
export class BannerComponent {
  /**
   * The name of the profile to display.
   */
  @Input() profileName = '';
  /**
   * The URL of the profile image.
   */
  @Input() profileImage = '';
  /**
   * The URL of the background image for the banner.
   */
  @Input() backgroundImage = '';
}
