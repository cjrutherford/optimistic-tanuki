import { Component, Input } from '@angular/core';

import { CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

@Component({
  selector: 'lib-author-profile',
  imports: [ProfilePhotoComponent, CardComponent, HeadingComponent],
  templateUrl: './author-profile.component.html',
  styleUrls: ['./author-profile.component.scss'],
})
export class AuthorProfileComponent {
  @Input() authorName = 'Author Name';
  @Input() authorBio = '';
  @Input() profileImage = 'https://picsum.photos/200'; // Placeholder image URL
}
