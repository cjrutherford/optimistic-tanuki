import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
})
export class AccordionComponent {
  @Input() sections: { heading: string, content: string, subItems?: { heading: string, content: string }[] }[] = [];
  expandedIndex = 0;

  toggleSection(index: number) {
    if (this.expandedIndex === index && this.sections.length > 1) {
      this.expandedIndex = -1;
    } else {
      this.expandedIndex = index;
    }
  }
}
