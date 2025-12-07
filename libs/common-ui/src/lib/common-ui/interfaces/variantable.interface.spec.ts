import { camelToKebab, variantOptionsToCssVars, VariantOptions } from './variantable.interface';

describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
        expect(camelToKebab('gradientStops')).toBe('gradient-stops');
        expect(camelToKebab('backgroundFilter')).toBe('background-filter');
        expect(camelToKebab('simple')).toBe('simple');
        expect(camelToKebab('SVGPattern')).toBe('svgpattern');
    });
});

describe('variantOptionsToCssVars', () => {
    it('should convert VariantOptions to CSS variables', () => {
        const options: VariantOptions = {
            gradientStops: ['#fff', '#000'],
            borderColor: 'red',
            borderWidth: '2px',
            backgroundFilter: 'blur(5px)',
        };
        const cssVars = variantOptionsToCssVars(options);
        expect(cssVars['style.--gradient-stops']).toBe('#fff, #000');
        expect(cssVars['style.--border-color']).toBe('red');
        expect(cssVars['style.--border-width']).toBe('2px');
        expect(cssVars['style.--background-filter']).toBe('blur(5px)');
    });

    it('should handle empty options', () => {
        expect(variantOptionsToCssVars({})).toEqual({});
    });

    it('should convert array values to comma-separated strings', () => {
        const options: VariantOptions = {
            gradientStops: ['#123', '#456', '#789'],
        };
        const cssVars = variantOptionsToCssVars(options);
        expect(cssVars['style.--gradient-stops']).toBe('#123, #456, #789');
    });

    it('should handle undefined values as empty strings', () => {
        const options: VariantOptions = {
            borderColor: undefined,
        };
        const cssVars = variantOptionsToCssVars(options);
        expect(cssVars['style.--border-color']).toBe('undefined');
    });
});