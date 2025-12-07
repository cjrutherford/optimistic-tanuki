import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'otui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
    '[class.glass]': 'variant === "glass"',
    '[class.gradient]': 'variant === "gradient"',
    '[class.sm]': 'size === "sm"',
    '[class.md]': 'size === "md"',
    '[class.lg]': 'size === "lg"',
  }
})
export class ModalComponent extends Themeable {
  @Input() heading = '';
  @Input() mode: 'sidebar'| 'sidebar-left' | 'trough' | 'standard-modal' | 'captive-modal' = 'standard-modal';
  @Input() variant: 'default' | 'glass' | 'gradient' = 'default';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() override background = 'var(--background, #222)';
  @Input() override foreground = 'var(--foreground, #fff)';
  @Input() override accent = 'var(--accent, #b1baec)';
  @Input() override complement = 'var(--complement, #919ee4)';
  @Input() override borderColor = 'var(--border-color, #b1baec)';
  @Input() override borderGradient = 'var(--border-gradient, linear-gradient(90deg, #b1baec, #919ee4))';
  @Input() override transitionDuration = '0.5s';
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
}
