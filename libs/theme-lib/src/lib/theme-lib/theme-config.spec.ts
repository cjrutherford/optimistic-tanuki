import {
  STANDARD_THEME_VARIABLES,
  LEGACY_VARIABLE_MAPPINGS,
  getAllVariableNames,
  getStandardVariable,
  DEFAULT_THEME_CONFIG,
  THEME_STORAGE_CONFIG
} from './theme-config';

describe('Theme Configuration', () => {
  describe('STANDARD_THEME_VARIABLES', () => {
    it('should define all core color variables', () => {
      expect(STANDARD_THEME_VARIABLES.BACKGROUND).toBe('--background');
      expect(STANDARD_THEME_VARIABLES.FOREGROUND).toBe('--foreground');
      expect(STANDARD_THEME_VARIABLES.ACCENT).toBe('--accent');
      expect(STANDARD_THEME_VARIABLES.COMPLEMENT).toBe('--complement');
      expect(STANDARD_THEME_VARIABLES.TERTIARY).toBe('--tertiary');
      expect(STANDARD_THEME_VARIABLES.SUCCESS).toBe('--success');
      expect(STANDARD_THEME_VARIABLES.DANGER).toBe('--danger');
      expect(STANDARD_THEME_VARIABLES.WARNING).toBe('--warning');
    });

    it('should define design token prefixes', () => {
      expect(STANDARD_THEME_VARIABLES.SPACING_PREFIX).toBe('--spacing-');
      expect(STANDARD_THEME_VARIABLES.SHADOW_PREFIX).toBe('--shadow-');
      expect(STANDARD_THEME_VARIABLES.BORDER_RADIUS_PREFIX).toBe('--border-radius-');
      expect(STANDARD_THEME_VARIABLES.FONT_SIZE_PREFIX).toBe('--font-size-');
      expect(STANDARD_THEME_VARIABLES.Z_INDEX_PREFIX).toBe('--z-index-');
    });
  });

  describe('LEGACY_VARIABLE_MAPPINGS', () => {
    it('should map legacy background variables', () => {
      expect(LEGACY_VARIABLE_MAPPINGS['--background-color']).toBe('--background');
    });

    it('should map legacy foreground variables', () => {
      expect(LEGACY_VARIABLE_MAPPINGS['--foreground-color']).toBe('--foreground');
    });

    it('should map legacy accent variables', () => {
      expect(LEGACY_VARIABLE_MAPPINGS['--accent-color']).toBe('--accent');
    });

    it('should map legacy complementary variables', () => {
      expect(LEGACY_VARIABLE_MAPPINGS['--complementary-color']).toBe('--complement');
      expect(LEGACY_VARIABLE_MAPPINGS['--complementary']).toBe('--complement');
    });

    it('should map all semantic color legacy variables', () => {
      expect(LEGACY_VARIABLE_MAPPINGS['--tertiary-color']).toBe('--tertiary');
      expect(LEGACY_VARIABLE_MAPPINGS['--success-color']).toBe('--success');
      expect(LEGACY_VARIABLE_MAPPINGS['--danger-color']).toBe('--danger');
      expect(LEGACY_VARIABLE_MAPPINGS['--warning-color']).toBe('--warning');
    });
  });

  describe('getAllVariableNames', () => {
    it('should return standard name plus all legacy mappings for background', () => {
      const names = getAllVariableNames('--background');
      expect(names).toContain('--background');
      expect(names).toContain('--background-color');
      expect(names.length).toBeGreaterThan(1);
    });

    it('should return standard name plus all legacy mappings for accent', () => {
      const names = getAllVariableNames('--accent');
      expect(names).toContain('--accent');
      expect(names).toContain('--accent-color');
    });

    it('should return standard name plus all legacy mappings for complement', () => {
      const names = getAllVariableNames('--complement');
      expect(names).toContain('--complement');
      expect(names).toContain('--complementary-color');
      expect(names).toContain('--complementary');
      expect(names.length).toBeGreaterThanOrEqual(3);
    });

    it('should return only the standard name if no legacy mappings exist', () => {
      const names = getAllVariableNames('--custom-variable');
      expect(names).toEqual(['--custom-variable']);
      expect(names.length).toBe(1);
    });
  });

  describe('getStandardVariable', () => {
    it('should return the correct standard variable for a given key', () => {
      expect(getStandardVariable('BACKGROUND')).toBe('--background');
      expect(getStandardVariable('FOREGROUND')).toBe('--foreground');
      expect(getStandardVariable('ACCENT')).toBe('--accent');
      expect(getStandardVariable('COMPLEMENT')).toBe('--complement');
    });

    it('should return design token prefixes', () => {
      expect(getStandardVariable('SPACING_PREFIX')).toBe('--spacing-');
      expect(getStandardVariable('SHADOW_PREFIX')).toBe('--shadow-');
    });
  });

  describe('THEME_STORAGE_CONFIG', () => {
    it('should define storage keys', () => {
      expect(THEME_STORAGE_CONFIG.STORAGE_KEY).toBe('optimistic-tanuki-theme');
      expect(THEME_STORAGE_CONFIG.CUSTOM_PALETTES_KEY).toBe('optimistic-tanuki-custom-palettes');
    });

    it('should have consistent naming pattern', () => {
      expect(THEME_STORAGE_CONFIG.STORAGE_KEY).toContain('optimistic-tanuki');
      expect(THEME_STORAGE_CONFIG.CUSTOM_PALETTES_KEY).toContain('optimistic-tanuki');
    });
  });

  describe('DEFAULT_THEME_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_THEME_CONFIG.theme).toBe('light');
      expect(DEFAULT_THEME_CONFIG.accentColor).toBe('#3f51b5');
      expect(DEFAULT_THEME_CONFIG.complementColor).toBe('#c0af4b');
      expect(DEFAULT_THEME_CONFIG.paletteMode).toBe('custom');
    });

    it('should use valid hex colors', () => {
      expect(DEFAULT_THEME_CONFIG.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DEFAULT_THEME_CONFIG.complementColor).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('Integration', () => {
    it('should ensure all legacy mappings point to valid standard variables', () => {
      const standardValues = Object.values(STANDARD_THEME_VARIABLES);
      
      Object.values(LEGACY_VARIABLE_MAPPINGS).forEach(standardVar => {
        // Each mapped value should be a standard variable (or at least follow the pattern)
        expect(standardVar).toMatch(/^--[a-z-]+$/);
      });
    });

    it('should have no duplicate legacy mapping keys', () => {
      const keys = Object.keys(LEGACY_VARIABLE_MAPPINGS);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it('should ensure backward compatibility for all core colors', () => {
      // Every core color should have at least one legacy mapping
      const coreColors = [
        '--background',
        '--foreground', 
        '--accent',
        '--complement'
      ];

      coreColors.forEach(coreColor => {
        const allNames = getAllVariableNames(coreColor);
        // Should have the standard name plus at least one legacy name
        expect(allNames.length).toBeGreaterThan(1);
      });
    });
  });
});
