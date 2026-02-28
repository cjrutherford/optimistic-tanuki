import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TileComponent, IconComponent } from '@optimistic-tanuki/common-ui';

@Component({
  standalone: true,
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss'],
  imports: [CommonModule, TileComponent, IconComponent],
})
export class FriendsComponent {
  @Input() friend: { photo: string; name: string } = {
    photo: 'https://placehold.it/300x300',
    name: 'Friend',
  };
}
