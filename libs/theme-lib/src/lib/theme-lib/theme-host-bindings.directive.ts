import { Directive, ElementRef, Input, OnChanges, SimpleChanges, OnDestroy, OnInit } from '@angular/core';
import { ThemeService } from './theme.service';
import { ThemeColors } from './theme.interface';
import { Subject, takeUntil } from 'rxjs';
import { STANDARD_THEME_VARIABLES } from './theme-config';

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
export class ThemeHostBindingsDirective implements OnInit, OnChanges, OnDestroy {
  @Input() themeHostBindings: HostThemeBindings = {};
  @Input() useThemeColors = true; // Whether to auto-bind to theme service colors
  @Input() useLocalScope = true; // Whether to use --local-* prefix for component-scoped variables

  private destroy$ = new Subject<void>();
  private isInitialized = false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.isInitialized = true;
    
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
    
    // Apply any initial bindings that were set before ngOnInit
    this.applyBindings();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['themeHostBindings'] && this.isInitialized) {
      this.applyBindings();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyThemeColors(colors: ThemeColors) {
    const element = this.elementRef.nativeElement;
    const prefix = this.useLocalScope ? '--local-' : '--';
    
    // Apply global theme colors as CSS custom properties on this element
    this.setProperty(element, `${prefix}accent`, colors.accent);
    this.setProperty(element, `${prefix}complement`, colors.complementary);
    this.setProperty(element, `${prefix}tertiary`, colors.tertiary);
    this.setProperty(element, `${prefix}success`, colors.success);
    this.setProperty(element, `${prefix}danger`, colors.danger);
    this.setProperty(element, `${prefix}warning`, colors.warning);
    this.setProperty(element, `${prefix}background`, colors.background);
    this.setProperty(element, `${prefix}foreground`, colors.foreground);

    // Apply any custom bindings that override the theme
    this.applyBindings();
  }

  private applyBindings() {
    const element = this.elementRef.nativeElement;
    const bindings = this.themeHostBindings;
    const prefix = this.useLocalScope ? '--local-' : '--';

    // Apply core color overrides (these take precedence over theme colors)
    if (bindings.accent) this.setProperty(element, `${prefix}accent`, bindings.accent);
    if (bindings.complement) this.setProperty(element, `${prefix}complement`, bindings.complement);
    if (bindings.tertiary) this.setProperty(element, `${prefix}tertiary`, bindings.tertiary);
    if (bindings.success) this.setProperty(element, `${prefix}success`, bindings.success);
    if (bindings.danger) this.setProperty(element, `${prefix}danger`, bindings.danger);
    if (bindings.warning) this.setProperty(element, `${prefix}warning`, bindings.warning);
    if (bindings.background) this.setProperty(element, `${prefix}background`, bindings.background);
    if (bindings.foreground) this.setProperty(element, `${prefix}foreground`, bindings.foreground);

    // Apply design token references
    if (bindings.spacing) this.setProperty(element, `${prefix}spacing`, SPACING_MAP[bindings.spacing]);
    if (bindings.shadow) this.setProperty(element, `${prefix}shadow`, SHADOW_MAP[bindings.shadow]);
    if (bindings.borderRadius) this.setProperty(element, `${prefix}border-radius`, BORDER_RADIUS_MAP[bindings.borderRadius]);
    if (bindings.fontSize) this.setProperty(element, `${prefix}font-size`, FONT_SIZE_MAP[bindings.fontSize]);

    // Apply custom variables
    if (bindings.customVars) {
      Object.entries(bindings.customVars).forEach(([key, value]) => {
        this.setProperty(element, `${prefix}${key}`, value);
      });
    }
  }

  /**
   * Helper method to safely set a CSS property
   * Includes error handling for SSR and edge cases
   */
  private setProperty(element: HTMLElement, property: string, value: string) {
    try {
      if (element && element.style) {
        element.style.setProperty(property, value);
      }
    } catch (error) {
      console.warn(`Failed to set CSS property ${property}:`, error);
    }
  }
}