import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-profile-photo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss',
})
/**
 * Component for displaying a profile photo.
 */
@Component({
  selector: 'lib-profile-photo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss',
})
export class ProfilePhotoComponent {
  /**
   * The source URL of the profile photo.
   */
  @Input() src = '';
  /**
   * The alt text for the profile photo.
   */
  @Input() alt = '';
}
