import { Component, Input } from '@angular/core';


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
}
