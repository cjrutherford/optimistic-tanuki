import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui'

@Component({
  selector: 'dh-community',
  imports: [CommonModule, TileComponent, HeadingComponent, ButtonComponent, ProfilePhotoComponent],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
})
export class CommunityComponent {}
