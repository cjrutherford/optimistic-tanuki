import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeColors,
  ThemeService,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import {
  Variantable,
  VariantOptions,
  VariantType,
} from '../interfaces/variantable.interface';
import { getDefaultVariantOptions } from '../interfaces/defaultVariantOptions';
import { Subject } from 'rxjs';

@Component({
  selector: 'otui-card',
  standalone: true,
  imports: [CommonModule],
  providers: [ThemeVariableService],
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  host: {
    '[class.theme]': 'theme',
    // Using standardized variable names with local scope
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-tertiary]': 'tertiary',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
    '[style.--local-variant]': 'variant',
    '[style.--local-background-filter]': 'backgroundFilter',
    '[style.--local-border-width]': 'borderWidth',
    '[style.--local-border-radius]': 'borderRadius',
    '[style.--local-border-style]': 'borderStyle',
    '[style.--local-background-gradient]': 'backgroundGradient',
    '[style.--local-svg-pattern]': 'svgPattern',
    '[style.--local-glow-filter]': 'glowFilter',
    '[style.--local-gradient-type]': 'gradientType',
    '[style.--local-gradient-stops]': 'gradientStops',
    '[style.--local-gradient-colors]': 'gradientColors',
    '[style.--local-animation]': 'animation',
    '[style.--local-hover-box-shadow]': 'hoverBoxShadow',
    '[style.--local-hover-gradient]': 'hoverGradient',
    '[style.--local-hover-glow-filter]': 'hoverGlowFilter',
    '[style.--local-inset-shadow]': 'insetShadow',
    '[style.--local-body-gradient]': 'bodyGradient',
    '[style.--local-background-pattern]': 'backgroundPattern',
    '[class.glass-effect]': 'glassEffect',
  },
})
export class CardComponent extends Variantable implements OnChanges {
  @Input() glassEffect = false;
  @Input() CardVariant: VariantType = 'default';
  @Input() variantOverrides?: VariantOptions;

  // Variant properties
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

  constructor(private themeVariableService: ThemeVariableService) {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['CardVariant'] && this.themeColors) {
      const currentVariant = changes['CardVariant'].currentValue;
      const options = this.variantOverrides
        ? {
            ...getDefaultVariantOptions(this.themeColors, currentVariant),
            ...this.variantOverrides,
          }
        : getDefaultVariantOptions(this.themeColors, currentVariant);
      this.setVariantOptions(options);
      this.applyVariant(this.themeColors, options);
    }
  }

  applyVariant(colors: ThemeColors, options?: VariantOptions): void {
    const opts = options ?? getDefaultVariantOptions(colors, this.CardVariant);
    this.setVariantOptions(opts);
  }

  private setVariantOptions(options: VariantOptions) {
    this.variant = options.variant ?? this.variant ?? 'default';
    this.backgroundFilter =
      options.backgroundFilter ?? this.backgroundFilter ?? 'none';
    this.borderWidth = options.borderWidth ?? this.borderWidth ?? '1px';
    this.borderRadius =
      options.borderRadius ??
      this.borderRadius ??
      'var(--border-radius-lg, 8px)';
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
        : this.gradientColors ?? 'var(--accent), var(--complement)';
    this.animation = options.animation ?? this.animation ?? 'none';
    this.hoverBoxShadow =
      options.hoverBoxShadow ??
      this.hoverBoxShadow ??
      'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))';
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
      options.transitionDuration ?? this.transitionDuration ?? '0.15s';
  }
}
