import { Directive, ElementRef, Input, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { ThemeService } from './theme.service';
import { ThemeColors } from './theme.interface';
import { Subject, takeUntil } from 'rxjs';

export interface HostThemeBindings {
  // Core theme colors
  accent?: string;
  complement?: string;
  tertiary?: string;
  success?: string;
  danger?: string;
  warning?: string;
  background?: string;
  foreground?: string;

  // Design tokens
  spacing?: keyof typeof SPACING_MAP;
  shadow?: keyof typeof SHADOW_MAP;
  borderRadius?: keyof typeof BORDER_RADIUS_MAP;
  fontSize?: keyof typeof FONT_SIZE_MAP;

  // Custom overrides (for specific use cases)
  customVars?: Record<string, string>;
}

const SPACING_MAP = {
  xs: 'var(--spacing-xs, 4px)',
  sm: 'var(--spacing-sm, 8px)', 
  md: 'var(--spacing-md, 16px)',
  lg: 'var(--spacing-lg, 24px)',
  xl: 'var(--spacing-xl, 32px)',
  xxl: 'var(--spacing-xxl, 48px)'
} as const;

const SHADOW_MAP = {
  none: 'var(--shadow-none, none)',
  sm: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
  md: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
  lg: 'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))',
  xl: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))'
} as const;

const BORDER_RADIUS_MAP = {
  none: 'var(--border-radius-none, 0)',
  sm: 'var(--border-radius-sm, 2px)',
  md: 'var(--border-radius-md, 4px)',
  lg: 'var(--border-radius-lg, 8px)',
  xl: 'var(--border-radius-xl, 12px)',
  full: 'var(--border-radius-full, 50%)'
} as const;

const FONT_SIZE_MAP = {
  xs: 'var(--font-size-xs, 0.75rem)',
  sm: 'var(--font-size-sm, 0.875rem)',
  base: 'var(--font-size-base, 1rem)',
  lg: 'var(--font-size-lg, 1.125rem)',
  xl: 'var(--font-size-xl, 1.25rem)',
  xxl: 'var(--font-size-xxl, 1.5rem)'
} as const;

@Directive({
  selector: '[themeHostBindings]',
  standalone: true
})
export class ThemeHostBindingsDirective implements OnChanges, OnDestroy {
  @Input() themeHostBindings: HostThemeBindings = {};
  @Input() useThemeColors = true; // Whether to auto-bind to theme service colors

  private destroy$ = new Subject<void>();

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private themeService: ThemeService
  ) {
    // Subscribe to theme changes if useThemeColors is enabled
    if (this.useThemeColors) {
      this.themeService.themeColors$
        .pipe(takeUntil(this.destroy$))
        .subscribe((colors) => {
          if (colors) {
            this.applyThemeColors(colors);
          }
        });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['themeHostBindings']) {
      this.applyBindings();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyThemeColors(colors: ThemeColors) {
    const element = this.elementRef.nativeElement;
    
    // Apply global theme colors as CSS custom properties on this element
    element.style.setProperty('--local-accent', colors.accent);
    element.style.setProperty('--local-complement', colors.complementary);
    element.style.setProperty('--local-tertiary', colors.tertiary);
    element.style.setProperty('--local-success', colors.success);
    element.style.setProperty('--local-danger', colors.danger);
    element.style.setProperty('--local-warning', colors.warning);
    element.style.setProperty('--local-background', colors.background);
    element.style.setProperty('--local-foreground', colors.foreground);

    // Apply any custom bindings that override the theme
    this.applyBindings();
  }

  private applyBindings() {
    const element = this.elementRef.nativeElement;
    const bindings = this.themeHostBindings;

    // Apply core color overrides (these take precedence over theme colors)
    if (bindings.accent) element.style.setProperty('--local-accent', bindings.accent);
    if (bindings.complement) element.style.setProperty('--local-complement', bindings.complement);
    if (bindings.tertiary) element.style.setProperty('--local-tertiary', bindings.tertiary);
    if (bindings.success) element.style.setProperty('--local-success', bindings.success);
    if (bindings.danger) element.style.setProperty('--local-danger', bindings.danger);
    if (bindings.warning) element.style.setProperty('--local-warning', bindings.warning);
    if (bindings.background) element.style.setProperty('--local-background', bindings.background);
    if (bindings.foreground) element.style.setProperty('--local-foreground', bindings.foreground);

    // Apply design token references
    if (bindings.spacing) element.style.setProperty('--local-spacing', SPACING_MAP[bindings.spacing]);
    if (bindings.shadow) element.style.setProperty('--local-shadow', SHADOW_MAP[bindings.shadow]);
    if (bindings.borderRadius) element.style.setProperty('--local-border-radius', BORDER_RADIUS_MAP[bindings.borderRadius]);
    if (bindings.fontSize) element.style.setProperty('--local-font-size', FONT_SIZE_MAP[bindings.fontSize]);

    // Apply custom variables
    if (bindings.customVars) {
      Object.entries(bindings.customVars).forEach(([key, value]) => {
        element.style.setProperty(`--local-${key}`, value);
      });
    }
  }
}