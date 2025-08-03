import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'otui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class ModalComponent extends Themeable {
  
  @Input() heading = '';
  @Input() mode: 'sidebar'| 'sidebar-left' | 'trough' | 'standard-modal' | 'captive-modal' = 'standard-modal';
  @Output() closeModal = new EventEmitter<void>();

  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
  }

  onClose() {
    console.log('closing modal')
    this.closeModal.emit();
  }
}
