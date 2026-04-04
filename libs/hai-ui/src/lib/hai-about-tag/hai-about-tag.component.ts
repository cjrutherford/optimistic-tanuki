import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiAboutModalComponent } from '../hai-about-modal/hai-about-modal.component';

@Component({
  selector: 'hai-about-tag',
  standalone: true,
  imports: [CommonModule, HaiAboutModalComponent],
  templateUrl: './hai-about-tag.component.html',
  styleUrl: './hai-about-tag.component.scss',
})
export class HaiAboutTagComponent {
  @Input({ required: true }) config!: HaiAboutConfig;

  readonly isOpen = signal(false);

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
