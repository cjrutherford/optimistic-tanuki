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
export class BannerComponent {
  @Input() profileName = '';
  @Input() profileImage = '';
  @Input() backgroundImage = '';
}
