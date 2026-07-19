import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'otui-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip.component.html',
  styleUrls: ['./chip.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[class.chip-deletable]': 'deletable',
  },
})
export class ChipComponent extends Themeable {
  @Input() variant: 'primary' | 'secondary' | 'success' | 'warning' | 'error' =
    'primary';
  @Input() deletable = false;
  @Input() disabled = false;
  @Output() delete = new EventEmitter<void>();

  // Chip colors now read the shared personality contract vars directly in
  // SCSS (--primary/--secondary/--success/--warning/--danger); the old
  // per-instance `--chip-*` CSS var mirroring these same global values has
  // been removed as redundant. Themeable still requires this hook.
  override applyTheme(_colors: ThemeColors): void {
    // no-op: chip styling is fully driven by global contract vars.
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) {
      this.delete.emit();
    }
  }
}
