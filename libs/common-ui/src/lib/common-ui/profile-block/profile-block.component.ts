import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-profile-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-block.component.html',
  styleUrls: ['./profile-block.component.scss'],
})
export class ProfileBlockComponent {
  @Input() profileName = '';
  @Input() profileImage = '';
  @Input() bio = '';
  @Input() actions: { label: string, callback: () => void }[] = [];
}
