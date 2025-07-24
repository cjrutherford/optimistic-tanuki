import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Themeable } from '@optimistic-tanuki/theme-ui';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'lib-select',
  imports: [CommonModule, FormsModule],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  standalone: true,
})
export class SelectComponent extends Themeable {
  @Input() options: Array<{ value: string; label: string }> = [
    { value: '', label: 'Please select' },
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  @Output() selectedValue: EventEmitter<string> = new EventEmitter<string>();

  constructor(protected override readonly themeService: ThemeService) {
    super(themeService);
  }

  override applyTheme(colors: any): void {
    this.theme = colors.theme || 'light';
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complement;
    this.borderColor = colors.borderColor || '#dee2e6';
    this.borderGradient = colors.borderGradient || 'linear-gradient(to right, #007bff, #6610f2)';
    this.transitionDuration = colors.transitionDuration || '0.3s';
  }
}
