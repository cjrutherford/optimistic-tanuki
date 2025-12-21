import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-tag-list',
  imports: [CommonModule],
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
})
export class TagListComponent {
  @Input() tags: string[] = [];
}
