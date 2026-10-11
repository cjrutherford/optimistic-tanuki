import { Component, Input } from '@angular/core';
import { StackComponent } from '../../content/private-cloud';

/** Stack components: plain-language role first, project name second. */
@Component({
  selector: 'hai-stack-list',
  standalone: true,
  templateUrl: './stack-list.component.html',
  styleUrl: './stack-list.component.scss',
})
export class StackListComponent {
  @Input({ required: true }) sectionId = '';
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) heading = '';
  @Input() intro = '';
  @Input({ required: true }) components: StackComponent[] = [];
}
