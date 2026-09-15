// Enhanced themeable interface with standardized CSS variables
import {
  Directive,
  OnDestroy,
  OnInit,
  ElementRef,
  inject,
} from '@angular/core';
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

  // Resolved theme colours. Until the first theme emission these read the
  // tokens ThemeService emits for the active personality. `accent` and
  // `complement` are the legacy names for the primary and secondary colours.
  background = 'var(--background)';
  foreground = 'var(--foreground)';
  accent = 'var(--primary)';
  complement = 'var(--secondary)';
  tertiary = 'var(--tertiary)';
  success = 'var(--success)';
  danger = 'var(--danger)';
  warning = 'var(--warning)';

  borderColor = 'var(--secondary)';
  borderGradient = 'var(--gradient-secondary)';
  transitionDuration = '0.15s';

  themeColors?: ThemeColors;
  protected destroy$ = new Subject<void>();
  protected elementRef = inject(ElementRef);
  protected readonly themeService = inject(ThemeService);

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter(
          (value) =>
            !!(value && value.background && value.foreground && value.accent)
        ),
        takeUntil(this.destroy$)
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
        },
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
    this.borderGradient =
      this.theme === 'dark'
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
