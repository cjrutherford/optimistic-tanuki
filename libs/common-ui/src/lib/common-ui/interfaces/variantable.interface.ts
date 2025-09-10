import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';
import { GradientBuilder, GradientType } from '../gradient-builder';
import { Directive, ElementRef, HostBinding, Renderer2 } from '@angular/core';

export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export type VariantType =
  | 'default'
  | 'gradient-glow'
  | 'electric-border'
  | 'gradient-glow-card'
  | 'gradient-background'
  | 'custom';

export interface VariantOptions {
  variant?: VariantType;
  backgroundFilter?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  borderStyle?: string;
  borderGradient?: string;
  background?: string;
  backgroundGradient?: string;
  svgPattern?: string;
  foreground?: string;
  accent?: string;
  complement?: string;
  glowFilter?: string;
  gradientType?: GradientType;
  gradientStops?: string[];
  gradientColors?: string[];
  transitionDuration?: string;
  animation?: string;
  hoverBoxShadow?: string;
  hoverGradient?: string;
  hoverGlowFilter?: string;
  insetShadow?: string;
  bodyGradient?: string;
  backgroundPattern?: string;
  [key: string]: any;
}

export function variantOptionsToCssVars(
  options: VariantOptions
): Record<string, string> {
  const cssVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    const kebabKey = camelToKebab(key);
    cssVars[`style.--${kebabKey}`] = Array.isArray(value)
      ? value.join(', ')
      : String(value) || '';
  }
  return cssVars;
}

@Directive()
export abstract class Variantable extends Themeable {
  variantOptions: VariantOptions = {};

  /**
   * Apply the theme colors and variant options to generate styles.
   */
  abstract applyVariant(colors: ThemeColors, options?: VariantOptions): void;

  applyTheme(colors: ThemeColors): void {
    this.applyVariant(colors);
  }

  /**
   * Utility: Generate gradient CSS string from theme colors and options.
   */
  protected buildGradient(
    colors: string[],
    type: GradientType = 'linear',
    angle = '90deg'
  ): string {
    return new GradientBuilder()
      .setType(type)
      .setOptions({ colors, angle })
      .build();
  }


  /**
   * Utility: Generate SVG pattern string (stub for extension).
   */
  protected buildSVGPattern(type: string, colors: string[]): string {
    // Implement SVG pattern generation logic as needed
    return '';
  }
}
