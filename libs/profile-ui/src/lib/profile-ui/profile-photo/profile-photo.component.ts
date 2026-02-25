import { Component, Input, Output, EventEmitter } from '@angular/core';

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
  @Input() size = 32;
  @Input() profileId = '';
  @Input() enableChat = false;
  @Output() startChat = new EventEmitter<string>();
}
