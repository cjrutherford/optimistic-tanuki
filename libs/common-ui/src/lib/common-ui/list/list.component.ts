
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul [ngClass]="[type, variant, size]">
      <ng-container *ngFor="let item of items; let i = index">
        <li><ng-content select="[list-item-{{i}}]"></ng-content>{{ item }}</li>
      </ng-container>
    </ul>
  `,
  styleUrls: ['./list.component.scss'],
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
export class ListComponent {
  @Input() items: string[] = [];
  @Input() type: 'bullet' | 'number' | 'dash' | 'block-list' = 'bullet';
  @Input() variant: 'default' | 'glass' | 'gradient' = 'default';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() background = 'var(--background, #222)';
  @Input() foreground = 'var(--foreground, #fff)';
  @Input() accent = 'var(--accent, #b1baec)';
  @Input() complement = 'var(--complement, #919ee4)';
  @Input() borderColor = 'var(--border-color, #b1baec)';
  @Input() borderGradient = 'var(--border-gradient, linear-gradient(90deg, #b1baec, #919ee4))';
  @Input() transitionDuration = '0.3s';
  theme = 'dark';
}
