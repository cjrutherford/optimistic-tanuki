import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
})
/**
 * A reusable accordion component.
 */
export class AccordionComponent {
  /**
   * An array of sections to display in the accordion.
   * Each section can have a heading, content, and optional sub-items.
   */
  @Input() sections: { heading: string, content: string, subItems?: { heading: string, content: string }[] }[] = [];
  /**
   * The index of the currently expanded section. Defaults to 0 (first section).
   */
  expandedIndex = 0;

  /**
   * Toggles the expansion state of a section.
   * If the clicked section is already expanded, it collapses it.
   * Otherwise, it expands the clicked section.
   * @param index The index of the section to toggle.
   */
  toggleSection(index: number) {
    if (this.expandedIndex === index && this.sections.length > 1) {
      this.expandedIndex = -1;
    } else {
      this.expandedIndex = index;
    }
  }
}
