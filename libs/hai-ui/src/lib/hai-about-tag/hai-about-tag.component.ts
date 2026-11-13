import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiLogoComponent } from '../hai-logo/hai-logo.component';
import { HaiAboutModalComponent } from '../hai-about-modal/hai-about-modal.component';

@Component({
  selector: 'hai-about-tag',
  standalone: true,
  imports: [CommonModule, HaiAboutModalComponent, HaiLogoComponent],
  templateUrl: './hai-about-tag.component.html',
  host: {
    '[class.inline]': "placement === 'inline'",
  },
  styleUrl: './hai-about-tag.component.scss',
})
export class HaiAboutTagComponent {
  @Input({ required: true }) config!: HaiAboutConfig;

  /** `fixed` floats over the page; `inline` always sits in the flow. */
  @Input() placement: 'fixed' | 'inline' = 'fixed';

  readonly isOpen = signal(false);

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
