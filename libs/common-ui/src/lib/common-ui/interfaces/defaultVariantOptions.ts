import { ThemeColors, generateColorShades } from '@optimistic-tanuki/theme-ui';
import { VariantOptions, VariantType } from './variantable.interface';
import {
  GradientBuilder,
  GradientType,
} from '../gradient-builder/gradient-builder';
import { hexToRgb } from '../glass-container.component';

function buildGradientFromOptions(
  type: GradientType,
  colors: string[],
  options: Partial<{
    angle: string;
    direction: string;
    shape: string;
    size: string;
    position: string;
  }> = {}
): string {
  return new GradientBuilder()
    .setType(type)
    .setOptions({ colors, ...options })
    .build();
}

export function getDefaultVariantOptions(
  colors: ThemeColors,
  variant: VariantType
): VariantOptions {
  // Ensure all VariantOptions properties are set for each variant
  switch (variant) {
    case 'gradient-glow': {
      const stops = generateColorShades(colors.accent, 3).map((s) => s[1]);
      return {
        variant,
        backgroundFilter: `rgba(${hexToRgb(colors.background)}, 0.6)`,
        borderColor: colors.accent,
        borderRadius: '12px',
        borderWidth: '6px',
        borderStyle: 'solid',
        gradientType: 'conic',
        gradientStops: stops,
        backgroundGradient: buildGradientFromOptions('conic', stops, {
          direction: 'to bottom',
        }),
        borderGradient: buildGradientFromOptions('conic', stops),
        gradientColors: [colors.accent],
        transitionDuration: '0.3s',
        backgroundPattern: '',
        svgPattern: '',
        insetShadow: `inset 2px 4px 6px rgba(${hexToRgb(colors.background)}, 0.1)`,
        animation: 'rotate 4s linear infinite',
        glowFilter: 'url(#glow-0)',
        hoverBoxShadow: `2px 4px 8px 6px ${colors.accent}, 2px 4px 12px 8px ${colors.complementary}`,
        hoverGlowFilter: 'url(#glow-1)',
        hoverBorderColor: colors.complementary,
        hoverBackgroundGradient: buildGradientFromOptions('conic', stops.reverse(), {
          direction: 'to top',
        }),
        hoverBorderGradient: buildGradientFromOptions('conic', stops.reverse()),
        hoverGradientColors: [colors.complementary],
        hoverTransitionDuration: '0.3s',
        hoverBackgroundPattern: '',
        hoverSvgPattern: '',
        hoverInsetShadow: `inset 2px 4px 6px rgba(${hexToRgb(colors.foreground)}, 0.15)`,
        hoverAnimation: 'rotate 2s linear infinite',
      };
    }
    case 'electric-border': {
      const stops = generateColorShades(colors.danger, 3).map((s) => s[1]);
      return {
        variant,
        backgroundFilter: `rgba(${hexToRgb(colors.background)}, 0.6)`,
        borderColor: colors.danger,
        borderRadius: '24px',
        borderWidth: '2px',
        borderStyle: 'solid',
        gradientType: 'linear',
        gradientStops: stops,
        backgroundGradient: '',
        borderGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to right',
        }),
        gradientColors: [colors.danger],
        transitionDuration: '0.3s',
        backgroundPattern: '',
        svgPattern: '',
        insetShadow: '',
        animation: '',
        glowFilter: 'url(#turbulent-displace)',
        hoverBoxShadow: `0 6px 12px 4px ${colors.danger}`,
        hoverGlowFilter: 'url(#turbulent-displace-hover)',
        hoverBorderColor: colors.success,
        hoverBackgroundGradient: '',
        hoverBorderGradient: buildGradientFromOptions('linear', stops.reverse(), {
          direction: 'to left',
        }),
        hoverGradientColors: [colors.success],
        hoverTransitionDuration: '0.3s',
        hoverBackgroundPattern: '',
        hoverSvgPattern: '',
        hoverInsetShadow: '',
        hoverAnimation: '',
      };
    }
    case 'gradient-glow-card': {
      const stops = generateColorShades(colors.success, 3).map((s) => s[1]);
      return {
        variant,
        backgroundFilter: `rgba(${hexToRgb(colors.background)}, 0.6)`,
        borderColor: colors.success,
        borderRadius: '1em',
        borderWidth: '4px',
        borderStyle: 'solid',
        gradientType: 'linear',
        gradientStops: stops,
        backgroundGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to right',
        }),
        borderGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to right',
        }),
        gradientColors: [colors.success],
        transitionDuration: '0.3s',
        backgroundPattern: '',
        svgPattern: '',
        insetShadow: '',
        animation: '',
        glowFilter: '',
        hoverBoxShadow: `0 0 8px 2px ${colors.success}`,
        hoverGlowFilter: '',
        hoverBorderColor: colors.accent,
        hoverBackgroundGradient: buildGradientFromOptions('linear', stops.reverse(), {
          direction: 'to left',
        }),
        hoverBorderGradient: buildGradientFromOptions('linear', stops.reverse(), {
          direction: 'to left',
        }),
        hoverGradientColors: [colors.accent],
        hoverTransitionDuration: '0.3s',
        hoverBackgroundPattern: '',
        hoverSvgPattern: '',
        hoverInsetShadow: '',
        hoverAnimation: '',
      };
    }
    case 'gradient-background': {
      const stops = [
        ...generateColorShades(colors.accent, 3).map((s) => s[1]),
        ...generateColorShades(colors.complementary, 3).map((s) => s[1]),
      ];
      return {
        variant,
        backgroundFilter: `rgba(${hexToRgb(colors.background)}, 0.2)`,
        borderColor: colors.background,
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        gradientType: 'linear',
        gradientStops: stops,
        backgroundGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to right',
        }),
        borderGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to right',
        }),
        gradientColors: [colors.background, colors.foreground],
        transitionDuration: '0.3s',
        backgroundPattern: '',
        svgPattern: '',
        insetShadow: '',
        animation: '',
        glowFilter: '',
        hoverBoxShadow: `0 0 8px 2px ${colors.foreground}`,
        hoverGlowFilter: '',
        hoverBorderColor: colors.complementary,
        hoverBackgroundGradient: buildGradientFromOptions('linear', stops.reverse(), {
          direction: 'to left',
        }),
        hoverBorderGradient: buildGradientFromOptions('linear', stops.reverse(), {
          direction: 'to left',
        }),
        hoverGradientColors: [colors.complementary],
        hoverTransitionDuration: '0.3s',
        hoverBackgroundPattern: '',
        hoverSvgPattern: '',
        hoverInsetShadow: '',
        hoverAnimation: '',
      };
    }
    case 'default':
    default: {
      const shadowStops = [
        ...generateColorShades(colors.accent, 3).map((s) => s[1]),
        // ...generateColorShades(colors.background, 3).map((s) => s[1]),
        ...generateColorShades(colors.complementary, 3).map((s) => s[1]),
      ];
      const borderStops = generateColorShades(colors.accent, 3).map((s) => s[1]);
      const stops = [
        ...generateColorShades(colors.complementary, 2).map((s) => s[1]), 
        ...generateColorShades(colors.accent, 2).map((s) => s[1]),
      ];
      return {
        variant: 'default',
        backgroundFilter: `rgba(${hexToRgb(colors.background)}, 0.2)`,
        borderColor: colors.complementary,
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        gradientType: 'linear',
        gradientStops: stops,
        backgroundGradient: buildGradientFromOptions('linear', stops, {
          direction: 'to bottom',
        }),
        borderGradient: buildGradientFromOptions('linear', borderStops, {
          direction: 'to right',
        }),
        gradientColors: [colors.accent, colors.complementary],
        transitionDuration: '0.3s',
        backgroundPattern: '',
        svgPattern: '',
        insetShadow: `inset 2px 4px 8px ${colors.complementary}`,
        animation: '',
        glowFilter: '',
        hoverBoxShadow: `0 0 8px 2px ${colors.complementary}`,
        hoverGlowFilter: '',
        hoverBorderColor: colors.accent,
        hoverBackgroundGradient: buildGradientFromOptions('linear', shadowStops.reverse(), {
          direction: 'to left',
        }),
        hoverBorderGradient: buildGradientFromOptions('linear', shadowStops.reverse(), {
          direction: 'to left',
        }),
        hoverGradientColors: [colors.accent],
        hoverTransitionDuration: '0.3s',
        hoverBackgroundPattern: '',
        hoverSvgPattern: '',
        hoverInsetShadow: `inset 4px 8px 16px ${colors.complementary}, inset 0 0 24px 8px ${colors.accent}, inset 0 0 32px 12px ${colors.background}`,
        hoverAnimation: '',
      };
    }
  }
}