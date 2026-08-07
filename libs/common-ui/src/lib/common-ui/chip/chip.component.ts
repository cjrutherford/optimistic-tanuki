import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import {
  CHIP_TONE_BRIDGE,
  type Emphasis,
  type Tone,
  type VariantSize,
} from '../interfaces/variant.contract';

/** @deprecated Use the canonical `tone` axis instead. */
export type ChipVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error';

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
  /** Canonical semantic tone. */
  @Input() tone: Tone = 'brand';
  /** Canonical visual treatment. Defaults to `soft` for inline use. */
  @Input() emphasis: Emphasis = 'soft';
  /** Canonical physical scale. */
  @Input() size: VariantSize = 'md';

  /**
   * Legacy treatment. Setting it maps onto the canonical `tone` axis via
   * {@link CHIP_TONE_BRIDGE}.
   *
   * @deprecated Use `tone` instead.
   */
  @Input() set variant(value: ChipVariant) {
    this._variant = value;
    const tone = CHIP_TONE_BRIDGE[value];
    if (tone) {
      this.tone = tone;
    }
  }
  get variant(): ChipVariant {
    return this._variant;
  }
  private _variant: ChipVariant = 'primary';

  @Input() deletable = false;
  @Input() disabled = false;
  @Output() delete = new EventEmitter<void>();

  // Chip styling is fully driven by the shared variant contract + global
  // personality vars in SCSS; no per-instance theme wiring is needed.
  override applyTheme(_colors: ThemeColors): void {
    // no-op: chip styling is driven by the shared variant mixin.
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) {
      this.delete.emit();
    }
  }
}
