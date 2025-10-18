import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class AccordionComponent {
  @Input() sections: { heading: string, content?: string, subItems?: { heading: string, content?: string }[] }[] = [];
  @Input() variant: 'default' | 'glass' | 'gradient' = 'default';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() background = 'var(--background, #222)';
  @Input() foreground = 'var(--foreground, #fff)';
  @Input() accent = 'var(--accent, #b1baec)';
  @Input() complement = 'var(--complement, #919ee4)';
  @Input() borderColor = 'var(--border-color, #b1baec)';
  @Input() borderGradient = 'var(--border-gradient, linear-gradient(90deg, #b1baec, #919ee4))';
  @Input() transitionDuration = '0.3s';
  expandedIndex = 0;

  toggleSection(index: number) {
    if (this.expandedIndex === index && this.sections.length > 1) {
      this.expandedIndex = -1;
    } else {
      this.expandedIndex = index;
    }
  }
}
