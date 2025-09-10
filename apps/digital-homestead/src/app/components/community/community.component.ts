import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent, TileComponent, GlassContainerComponent } from '@optimistic-tanuki/common-ui';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui'
import { AuthorProfileComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-community',
  imports: [CommonModule, TileComponent, HeadingComponent, ButtonComponent, ProfilePhotoComponent, AuthorProfileComponent, GlassContainerComponent],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
})
export class CommunityComponent {}
