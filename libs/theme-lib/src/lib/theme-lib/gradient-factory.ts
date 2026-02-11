import { Injectable } from '@angular/core';
import { ThemeColors } from './theme.interface';

export type GradientType =
  | 'linear'
  | 'conic'
  | 'radial'
  | 'repeating-linear'
  | 'repeating-conic'
  | 'repeating-radial';

export interface GradientConfig {
  type: GradientType;
  direction?: string;
  colors: string[];
  stops?: number[];
  animation?: {
    type: 'rotate' | 'pulse' | 'wave' | 'shimmer' | 'breathe';
    duration: string;
    direction?: 'clockwise' | 'counter-clockwise';
  };
}

export interface PersonalityGradientStrategy {
  id: string;
  name: string;
  appliesTo: {
    buttons: boolean;
    cards: boolean;
    headers: boolean;
    backgrounds: boolean;
    borders: boolean;
    badges: boolean;
  };
  buttonGradient: GradientConfig;
  cardGradient: GradientConfig;
  headerGradient: GradientConfig;
  backgroundGradient: GradientConfig;
  borderGradient: GradientConfig;
  prefersAnimation: boolean;
  animationDuration: string;
  animationEasing: string;
}

@Injectable({
  providedIn: 'root',
})
export class GradientFactory {
  private strategies: Map<string, PersonalityGradientStrategy> = new Map();
  private defaultStrategy: PersonalityGradientStrategy;

  constructor() {
    this.defaultStrategy = this.createClassicStrategy();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set('classic', this.createClassicStrategy());
    this.strategies.set('minimal', this.createMinimalStrategy());
    this.strategies.set('bold', this.createBoldStrategy());
    this.strategies.set('soft', this.createSoftStrategy());
    this.strategies.set('professional', this.createProfessionalStrategy());
    this.strategies.set('playful', this.createPlayfulStrategy());
    this.strategies.set('elegant', this.createElegantStrategy());
  }

  getStrategy(personalityId: string): PersonalityGradientStrategy {
    return this.strategies.get(personalityId) || this.defaultStrategy;
  }

  createButtonGradient(
    colors: ThemeColors,
    personalityId: string,
    variant: 'primary' | 'secondary' | 'outlined'
  ): string {
    const strategy = this.getStrategy(personalityId);

    if (!strategy.appliesTo.buttons) {
      return 'none';
    }

    const config = this.getButtonConfig(strategy, colors, variant);
    if (!config) return 'none';

    return this.buildGradient(config, colors);
  }

  createCardGradient(
    colors: ThemeColors,
    personalityId: string,
    variant: 'elevated' | 'glass' | 'flat' | 'gradient'
  ): string {
    const strategy = this.getStrategy(personalityId);

    if (!strategy.appliesTo.cards || variant === 'flat') {
      return 'none';
    }

    const config =
      variant === 'gradient'
        ? strategy.cardGradient
        : this.getCardConfig(strategy, colors, variant);
    if (!config) return 'none';

    return this.buildGradient(config, colors);
  }

  createHeaderGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);

    if (!strategy.appliesTo.headers) {
      return 'none';
    }

    return this.buildGradient(strategy.headerGradient, colors);
  }

  createBackgroundGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);

    if (!strategy.appliesTo.backgrounds) {
      return 'none';
    }

    return this.buildGradient(strategy.backgroundGradient, colors);
  }

  createBorderGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);

    if (!strategy.appliesTo.borders) {
      return 'none';
    }

    return this.buildGradient(strategy.borderGradient, colors);
  }

  private buildGradient(config: GradientConfig, colors: ThemeColors): string {
    const resolvedColors = this.resolveColors(config.colors, colors);
    const stopsStr = config.stops ? `, ${config.stops.join('%, ')}%` : '';

    let gradient = '';

    switch (config.type) {
      case 'linear':
        gradient = `linear-gradient(${
          config.direction ?? '90deg'
        }, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'conic':
        gradient = `conic-gradient(from ${
          config.direction ?? '0deg'
        } at 50% 50%, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'radial':
        gradient = `radial-gradient(ellipse at center, ${resolvedColors.join(
          ', '
        )}${stopsStr})`;
        break;
      case 'repeating-linear':
        gradient = `repeating-linear-gradient(${
          config.direction ?? '90deg'
        }, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'repeating-conic':
        gradient = `repeating-conic-gradient(from ${
          config.direction ?? '0deg'
        } at 50% 50%, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'repeating-radial':
        gradient = `repeating-radial-gradient(ellipse at center, ${resolvedColors.join(
          ', '
        )}${stopsStr})`;
        break;
    }

    return gradient;
  }

  private getButtonConfig(
    strategy: PersonalityGradientStrategy,
    colors: ThemeColors,
    variant: string
  ): GradientConfig | null {
    switch (variant) {
      case 'primary':
        return strategy.buttonGradient;
      case 'secondary':
        return {
          ...strategy.buttonGradient,
          colors: [colors.complementary, colors.tertiary],
        };
      case 'outlined':
        return null;
      default:
        return strategy.buttonGradient;
    }
  }

  private getCardConfig(
    strategy: PersonalityGradientStrategy,
    colors: ThemeColors,
    variant: string
  ): GradientConfig | null {
    switch (variant) {
      case 'glass':
        return {
          type: 'linear',
          direction: 'to bottom',
          colors: [
            `rgba(${this.hexToRgb(colors.accent)}, 0.1)`,
            `rgba(${this.hexToRgb(colors.complementary)}, 0.05)`,
          ],
        };
      case 'elevated':
        return {
          ...strategy.cardGradient,
          colors: [colors.background, colors.foreground],
        };
      default:
        return null;
    }
  }

  private resolveColors(colors: string[], _themeColors: ThemeColors): string[] {
    return colors.map((color) => {
      if (color.startsWith('var(--')) return color;
      if (color.startsWith('--')) return `var(${color})`;
      return color;
    });
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
      result[3],
      16
    )}`;
  }

  private createClassicStrategy(): PersonalityGradientStrategy {
    return {
      id: 'classic',
      name: 'Classic',
      appliesTo: {
        buttons: true,
        cards: false,
        headers: false,
        backgrounds: false,
        borders: false,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--accent)', 'var(--complement)'],
        stops: [0, 100],
        animation: { type: 'shimmer', duration: '3s' },
      },
      cardGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'var(--foreground)'],
      },
      headerGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'transparent'],
      },
      backgroundGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'var(--foreground)'],
      },
      borderGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--complement)'],
      },
      prefersAnimation: true,
      animationDuration: '200ms',
      animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  private createMinimalStrategy(): PersonalityGradientStrategy {
    return {
      id: 'minimal',
      name: 'Minimal',
      appliesTo: {
        buttons: false,
        cards: false,
        headers: false,
        backgrounds: false,
        borders: false,
        badges: false,
      },
      buttonGradient: { type: 'linear', direction: 'to bottom', colors: [] },
      cardGradient: { type: 'linear', direction: 'to bottom', colors: [] },
      headerGradient: { type: 'linear', direction: 'to right', colors: [] },
      backgroundGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: [],
      },
      borderGradient: { type: 'linear', direction: 'to right', colors: [] },
      prefersAnimation: false,
      animationDuration: '150ms',
      animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  private createBoldStrategy(): PersonalityGradientStrategy {
    return {
      id: 'bold',
      name: 'Bold',
      appliesTo: {
        buttons: true,
        cards: true,
        headers: true,
        backgrounds: true,
        borders: true,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: '135deg',
        colors: ['var(--accent)', 'var(--complement)', 'var(--tertiary)'],
        stops: [0, 50, 100],
        animation: { type: 'shimmer', duration: '3s' },
      },
      cardGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'var(--accent)', 'var(--foreground)'],
        stops: [0, 30, 100],
        animation: { type: 'pulse', duration: '4s' },
      },
      headerGradient: {
        type: 'conic',
        direction: 'from bottom left',
        colors: ['var(--accent)', 'var(--complement)', 'var(--tertiary)'],
        animation: { type: 'rotate', duration: '20s', direction: 'clockwise' },
      },
      backgroundGradient: {
        type: 'radial',
        direction: 'at center',
        colors: [
          'rgba(var(--accent-rgb), 0.12)',
          'rgba(var(--complement-rgb), 0.08)',
          'rgba(var(--tertiary-rgb), 0.08)',
        ],
        animation: { type: 'wave', duration: '15s' },
      },
      borderGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--complement)'],
        animation: { type: 'shimmer', duration: '2s' },
      },
      prefersAnimation: true,
      animationDuration: '300ms',
      animationEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  }

  private createSoftStrategy(): PersonalityGradientStrategy {
    return {
      id: 'soft',
      name: 'Soft',
      appliesTo: {
        buttons: true,
        cards: true,
        headers: true,
        backgrounds: false,
        borders: true,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--accent)', 'var(--tertiary)'],
        stops: [0, 100],
        animation: { type: 'breathe', duration: '4s' },
      },
      cardGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'rgba(var(--accent-rgb), 0.08)'],
      },
      headerGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--tertiary)'],
      },
      backgroundGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'var(--foreground)'],
      },
      borderGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--tertiary)'],
      },
      prefersAnimation: true,
      animationDuration: '400ms',
      animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  private createProfessionalStrategy(): PersonalityGradientStrategy {
    return {
      id: 'professional',
      name: 'Professional',
      appliesTo: {
        buttons: true,
        cards: false,
        headers: false,
        backgrounds: false,
        borders: false,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--accent)', 'var(--complement)'],
        stops: [0, 100],
      },
      cardGradient: { type: 'linear', direction: 'to bottom', colors: [] },
      headerGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'transparent'],
      },
      backgroundGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'var(--foreground)'],
      },
      borderGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--complement)'],
      },
      prefersAnimation: false,
      animationDuration: '150ms',
      animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  private createPlayfulStrategy(): PersonalityGradientStrategy {
    return {
      id: 'playful',
      name: 'Playful',
      appliesTo: {
        buttons: true,
        cards: true,
        headers: true,
        backgrounds: true,
        borders: true,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: '135deg',
        colors: ['var(--accent)', 'var(--tertiary)'],
        stops: [0, 100],
        animation: { type: 'shimmer', duration: '2s' },
      },
      cardGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--background)', 'rgba(var(--accent-rgb), 0.15)'],
        animation: { type: 'breathe', duration: '3s' },
      },
      headerGradient: {
        type: 'conic',
        direction: 'from top left',
        colors: ['var(--accent)', 'var(--complement)', 'var(--tertiary)'],
        animation: { type: 'rotate', duration: '15s', direction: 'clockwise' },
      },
      backgroundGradient: {
        type: 'radial',
        direction: 'at center',
        colors: ['rgba(var(--accent-rgb), 0.1)', 'transparent'],
        animation: { type: 'pulse', duration: '5s' },
      },
      borderGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--tertiary)'],
        animation: { type: 'shimmer', duration: '2s' },
      },
      prefersAnimation: true,
      animationDuration: '300ms',
      animationEasing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    };
  }

  private createElegantStrategy(): PersonalityGradientStrategy {
    return {
      id: 'elegant',
      name: 'Elegant',
      appliesTo: {
        buttons: true,
        cards: true,
        headers: true,
        backgrounds: true,
        borders: true,
        badges: true,
      },
      buttonGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'var(--complement)'],
        stops: [0, 100],
      },
      cardGradient: {
        type: 'linear',
        direction: 'to bottom right',
        colors: ['var(--background)', 'rgba(var(--accent-rgb), 0.05)'],
      },
      headerGradient: {
        type: 'linear',
        direction: 'to right',
        colors: ['var(--accent)', 'transparent'],
      },
      backgroundGradient: {
        type: 'linear',
        direction: '135deg',
        colors: ['rgba(var(--accent-rgb), 0.03)', 'transparent'],
      },
      borderGradient: {
        type: 'linear',
        direction: 'to bottom',
        colors: ['var(--accent)', 'var(--complement)'],
      },
      prefersAnimation: true,
      animationDuration: '400ms',
      animationEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }
}
