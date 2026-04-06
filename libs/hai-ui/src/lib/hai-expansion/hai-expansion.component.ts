import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { getRandomHaiExpansion } from '../hai-types/hai-expansions';

@Component({
  selector: 'hai-expansion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="hai-expansion-shell" (click)="regenerate()">
      <span class="hai-initials">HAI</span>
      @if (showExpansion()) {
        <span class="hai-expansion-copy">
          <span class="bracket">(</span>{{ currentExpansion() }}<span class="bracket">)</span>
        </span>
      }
    </span>
  `,
  styles: [`
    .hai-expansion-shell {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5ch;
      user-select: none;
      transition: color 0.2s ease;
    }

    .hai-initials {
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .hai-expansion-copy {
      font-style: italic;
      opacity: 0.8;
      font-size: 0.9em;
    }

    .bracket {
      opacity: 0.5;
      margin: 0 0.1ch;
    }

    .hai-expansion-shell:hover .hai-initials {
      color: var(--primary, #3b82f6);
    }
  `]
})
export class HaiExpansionComponent implements OnInit {
  @Input() showExpansionOnInit = true;

  readonly currentExpansion = signal('');
  readonly showExpansion = signal(false);

  ngOnInit() {
    this.currentExpansion.set(getRandomHaiExpansion());
    if (this.showExpansionOnInit) {
      this.showExpansion.set(true);
    }
  }

  regenerate() {
    this.currentExpansion.set(getRandomHaiExpansion());
    this.showExpansion.set(true);
  }
}
