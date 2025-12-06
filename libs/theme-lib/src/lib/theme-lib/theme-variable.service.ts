import { Injectable, ElementRef } from '@angular/core';
import { STANDARD_THEME_VARIABLES, getAllVariableNames } from './theme-config';

/**
 * Service to help manage CSS variable overrides at component level
 * This provides a better way to handle host bindings and DOM-level overrides
 * Uses standardized variable names for consistency
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeVariableService {
  
  /**
   * Apply standardized theme variables to an element with proper cascade handling
   */
  applyThemeVariables(
    elementRef: ElementRef<HTMLElement>, 
    variables: Record<string, string>,
    scope: 'local' | 'inherited' = 'local'
  ) {
    const element = elementRef.nativeElement;
    const prefix = scope === 'local' ? '--local-' : '--';
    
    Object.entries(variables).forEach(([key, value]) => {
      element.style.setProperty(`${prefix}${key}`, value);
    });
  }

  /**
   * Helper to remove CSS variable prefix (--) from variable name
   */
  private removeVarPrefix(variable: string): string {
    return variable.startsWith('--') ? variable.substring(2) : variable;
  }

  /**
   * Create a host binding object using standardized variable names
   * This replaces the manual host binding definitions in component decorators
   * Automatically normalizes legacy variable names to standardized names
   */
  createStandardizedHostBindings(bindings: Record<string, string>): Record<string, string> {
    const hostBindings: Record<string, string> = {};
    
    // Map of common variations to standard variable names
    const variableMap: Record<string, string> = {
      'accent': this.removeVarPrefix(STANDARD_THEME_VARIABLES.ACCENT),
      'accent-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.ACCENT),
      'complement': this.removeVarPrefix(STANDARD_THEME_VARIABLES.COMPLEMENT), 
      'complementary': this.removeVarPrefix(STANDARD_THEME_VARIABLES.COMPLEMENT),
      'complementary-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.COMPLEMENT),
      'foreground': this.removeVarPrefix(STANDARD_THEME_VARIABLES.FOREGROUND),
      'foreground-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.FOREGROUND),
      'background': this.removeVarPrefix(STANDARD_THEME_VARIABLES.BACKGROUND),
      'background-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.BACKGROUND),
      'tertiary': this.removeVarPrefix(STANDARD_THEME_VARIABLES.TERTIARY),
      'tertiary-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.TERTIARY),
      'success': this.removeVarPrefix(STANDARD_THEME_VARIABLES.SUCCESS),
      'success-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.SUCCESS),
      'danger': this.removeVarPrefix(STANDARD_THEME_VARIABLES.DANGER), 
      'danger-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.DANGER),
      'warning': this.removeVarPrefix(STANDARD_THEME_VARIABLES.WARNING),
      'warning-color': this.removeVarPrefix(STANDARD_THEME_VARIABLES.WARNING)
    };

    Object.entries(bindings).forEach(([property, value]) => {
      // Extract variable name from property like '[style.--accent]'
      const match = property.match(/\[style\.--([^\]]+)\]/);
      if (match) {
        const varName = match[1];
        const standardName = variableMap[varName] || varName;
        hostBindings[`[style.--${standardName}]`] = value;
      } else {
        hostBindings[property] = value;
      }
    });

    return hostBindings;
  }

  /**
   * Generate CSS custom properties object for use in component styles
   */
  generateComponentCSSVariables(
    themeColors: Record<string, string>,
    localOverrides: Record<string, string> = {}
  ): Record<string, string> {
    const cssVars: Record<string, string> = {};
    
    // Set theme colors as fallbacks
    Object.entries(themeColors).forEach(([key, value]) => {
      cssVars[`--${key}`] = value;
    });
    
    // Apply local overrides
    Object.entries(localOverrides).forEach(([key, value]) => {
      cssVars[`--local-${key}`] = value;
    });
    
    return cssVars;
  }

  /**
   * Remove all local CSS variables from an element
   */
  clearLocalVariables(elementRef: ElementRef<HTMLElement>) {
    const element = elementRef.nativeElement;
    const styles = element.style;
    
    // Remove all --local-* properties
    for (let i = styles.length - 1; i >= 0; i--) {
      const property = styles.item(i);
      if (property.startsWith('--local-')) {
        element.style.removeProperty(property);
      }
    }
  }

  /**
   * Create a CSS variable fallback chain
   * Usage: `color: ${createFallbackChain(['--local-accent', '--accent', '#3f51b5'])}`
   */
  createFallbackChain(variables: string[]): string {
    return variables.map(v => v.startsWith('--') ? `var(${v})` : v).join(', ');
  }
}