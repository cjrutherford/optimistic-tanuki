import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-profile-photo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss',
})
export class ProfilePhotoComponent {
  @Input() src = '';
  @Input() alt = '';
}
