import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiAboutModalComponent } from '../hai-about-modal/hai-about-modal.component';

@Component({
  selector: 'hai-about-tag',
  standalone: true,
  imports: [CommonModule, HaiAboutModalComponent],
  templateUrl: './hai-about-tag.component.html',
  host: {
    '[class.inline]': "placement === 'inline'",
    '[class.inline-compact]': "placement === 'inline-compact'",
  },
  styleUrl: './hai-about-tag.component.scss',
})
export class HaiAboutTagComponent {
  @Input({ required: true }) config!: HaiAboutConfig;

  /**
   * `fixed` floats over the page; `inline` always sits in the flow;
   * `inline-compact` floats on wide screens and moves into the flow (after the
   * page content, so it reserves its own space) on small ones.
   */
  @Input() placement: 'fixed' | 'inline' | 'inline-compact' = 'fixed';

  readonly isOpen = signal(false);

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
