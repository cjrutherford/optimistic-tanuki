import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Variantable,
  VariantOptions,
  VariantType,
} from '../interfaces/variantable.interface';
import { ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';
import { getDefaultVariantOptions } from '../interfaces/defaultVariantOptions';

@Component({
  selector: 'otui-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tile.component.html',
  styleUrls: ['./tile.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--variant]': 'variant',
    '[style.--background-filter]': 'backgroundFilter',
    '[style.--border-width]': 'borderWidth',
    '[style.--border-radius]': 'borderRadius',
    '[style.--border-style]': 'borderStyle',
    '[style.--background-gradient]': 'backgroundGradient',
    '[style.--svg-pattern]': 'svgPattern',
    '[style.--glow-filter]': 'glowFilter',
    '[style.--gradient-type]': 'gradientType',
    '[style.--gradient-stops]': 'gradientStops',
    '[style.--gradient-colors]': 'gradientColors',
    '[style.--animation]': 'animation',
    '[style.--hover-box-shadow]': 'hoverBoxShadow',
    '[style.--hover-gradient]': 'hoverGradient',
    '[style.--hover-glow-filter]': 'hoverGlowFilter',
    '[style.--inset-shadow]': 'insetShadow',
    '[style.--body-gradient]': 'bodyGradient',
    '[style.--background-pattern]': 'backgroundPattern',
  },
})
export class TileComponent extends Variantable implements OnChanges {
  @Input() TileVariant: VariantType = 'default';
  variant!: string;
  backgroundFilter!: string;
  borderWidth!: string;
  borderRadius!: string;
  borderStyle!: string;
  backgroundGradient!: string;
  svgPattern!: string;
  glowFilter!: string;
  gradientType!: string;
  gradientStops!: string;
  gradientColors!: string;
  animation!: string;
  hoverBoxShadow!: string;
  hoverGradient!: string;
  hoverGlowFilter!: string;
  insetShadow!: string;
  bodyGradient!: string;
  backgroundPattern!: string;

  // Apply the variant styles based on the provided options and theme colors

  constructor() {
    super();
  }

  override applyVariant(colors: ThemeColors, options?: VariantOptions): void {
    const opts = options ?? getDefaultVariantOptions(colors, this.TileVariant);
    this.setVariantOptions(opts);
  }

  private setVariantOptions(options: VariantOptions) {
    this.variant = options.variant ?? this.variant ?? 'default';
    this.backgroundFilter =
      options.backgroundFilter ?? this.backgroundFilter ?? 'none';
    this.borderWidth = options.borderWidth ?? this.borderWidth ?? '1px';
    this.borderRadius = options.borderRadius ?? this.borderRadius ?? '8px';
    this.borderStyle = options.borderStyle ?? this.borderStyle ?? 'solid';
    this.backgroundGradient =
      options.backgroundGradient ?? this.backgroundGradient ?? 'none';
    this.svgPattern = options.svgPattern ?? this.svgPattern ?? '';
    this.glowFilter = options.glowFilter ?? this.glowFilter ?? 'none';
    this.gradientType = options.gradientType ?? this.gradientType ?? 'linear';
    this.gradientStops =
      options.gradientStops !== undefined
        ? Array.isArray(options.gradientStops)
          ? options.gradientStops.join(', ')
          : options.gradientStops
        : this.gradientStops ?? '0%, 100%';
    this.gradientColors =
      options.gradientColors !== undefined
        ? Array.isArray(options.gradientColors)
          ? options.gradientColors.join(', ')
          : options.gradientColors
        : this.gradientColors ?? '#fff, #eee';
    this.animation = options.animation ?? this.animation ?? 'none';
    this.hoverBoxShadow =
      options.hoverBoxShadow ??
      this.hoverBoxShadow ??
      '0 2px 8px rgba(0,0,0,0.1)';
    this.hoverGradient = options.hoverGradient ?? this.hoverGradient ?? 'none';
    this.hoverGlowFilter =
      options.hoverGlowFilter ?? this.hoverGlowFilter ?? 'none';
    this.insetShadow = options.insetShadow ?? this.insetShadow ?? 'none';
    this.bodyGradient = options.bodyGradient ?? this.bodyGradient ?? 'none';
    this.backgroundPattern =
      options.backgroundPattern ?? this.backgroundPattern ?? '';
    this.borderGradient =
      options.borderGradient ?? this.borderGradient ?? 'none';
    this.transitionDuration =
      options.transitionDuration ?? this.transitionDuration ?? '0.3s';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['TileVariant'] && this.themeColors) {
      const currentVariant = changes['TileVariant'].currentValue;
      const options = getDefaultVariantOptions(
        this.themeColors,
        currentVariant
      );
      this.applyVariant(this.themeColors, options);
    }
  }
}
