// Enhanced themeable interface with standardized CSS variables
import { Directive, OnDestroy, OnInit, ElementRef, inject } from '@angular/core';
import { Subject, filter, takeUntil } from 'rxjs';

import { ThemeColors } from './theme.interface';
import { ThemeService } from './theme.service';

/**
 * Enhanced base class for components that need theme support.
 * Uses standardized CSS variable names and provides better host binding management.
 */
@Directive()
export abstract class Themeable implements OnInit, OnDestroy {
  theme: 'light' | 'dark' = 'light';
  
  // Core theme colors using standardized names
  background = 'var(--background, #ffffff)';
  foreground = 'var(--foreground, #212121)';
  accent = 'var(--accent, #3f51b5)';
  complement = 'var(--complement, #c0af4b)';
  tertiary = 'var(--tertiary, #7e57c2)';
  success = 'var(--success, #4caf50)';
  danger = 'var(--danger, #f44336)';
  warning = 'var(--warning, #ff9800)';
  
  // Legacy support for existing components
  borderColor = 'var(--complement, #c0af4b)';
  borderGradient = 'var(--complement-gradient-light, linear-gradient(135deg, #c0af4b, #3f51b5))';
  transitionDuration = '0.15s';
  
  themeColors?: ThemeColors;
  protected destroy$ = new Subject<void>();
  protected elementRef = inject(ElementRef);

  constructor(protected readonly themeService: ThemeService) {}

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter(
          (value) =>
            !!(value && value.background && value.foreground && value.accent),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (colors: ThemeColors | undefined) => {
          if (colors) {
            this.theme = this.themeService.getTheme();
            this.themeColors = colors;
            this.updateStandardizedVariables(colors);
            this.applyTheme(colors);
          }
        },
        error: (err: any) => {
          console.error('Error fetching theme colors:', err);
        },
        complete: () => {
          return;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Updates the component's CSS variables to use standardized names
   */
  private updateStandardizedVariables(colors: ThemeColors) {
    // Update properties to use the standardized variables
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.tertiary = colors.tertiary;
    this.success = colors.success;
    this.danger = colors.danger;
    this.warning = colors.warning;
    
    // Update legacy properties for backward compatibility
    this.borderColor = colors.complementary;
    this.borderGradient = this.theme === 'dark' 
      ? colors.complementaryGradients['dark']
      : colors.complementaryGradients['light'];
  }

  /**
   * Set local CSS variables on the component's host element.
   * This provides component-level overrides that don't affect global theme.
   */
  protected setLocalCSSVariable(name: string, value: string) {
    if (this.elementRef?.nativeElement) {
      this.elementRef.nativeElement.style.setProperty(`--local-${name}`, value);
    }
  }

  /**
   * Set multiple local CSS variables at once
   */
  protected setLocalCSSVariables(variables: Record<string, string>) {
    Object.entries(variables).forEach(([name, value]) => {
      this.setLocalCSSVariable(name, value);
    });
  }

  /**
   * Abstract method that components must implement to handle theme changes
   */
  abstract applyTheme(colors: ThemeColors): void;
}