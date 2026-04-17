import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'otui-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss'],
  host: {
    '[class.theme]': 'theme',
  },
})
export class DropdownComponent extends Themeable {
  @Input() triggerLabel = '';
  @Input() disabled = false;
  @Output() close = new EventEmitter<void>();
  @Output() open = new EventEmitter<void>();

  isOpen = false;

  constructor(private elRef: ElementRef) {
    super();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      'dropdown-bg': colors.background,
      'dropdown-border': colors.complementary,
      'dropdown-hover-bg': `${colors.accent}15`,
    });
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.open.emit();
    } else {
      this.close.emit();
    }
  }

  closeDropdown(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.close.emit();
    }
  }
}
