import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
})
export class BreadcrumbComponent {
  @Input() nodes: string[] = [];
  @Input() variant: 'default' | 'glass' | 'gradient' = 'default';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() background = 'var(--background)';
  @Input() foreground = 'var(--foreground)';
  @Input() accent = 'var(--primary)';
  @Input() complement = 'var(--secondary)';
  @Input() borderColor = 'var(--border)';
  @Input() borderGradient =
    'var(--gradient-border, linear-gradient(90deg, var(--primary), var(--secondary)))';
  @Input() transitionDuration = '0.3s';
  showPopup = false;

  togglePopup() {
    this.showPopup = !this.showPopup;
  }
}
