/**
 * Compatibility shim for legacy personality gradient imports.
 *
 * Canonical gradient definitions now live in `gradient-factory.ts`.
 */

import {
    createGradientVariablesFromTheme,
    resolvePersonalityGradientTheme,
    PERSONALITY_GRADIENT_THEMES,
    GRADIENT_PERSONALITY_ALIASES,
    type PersonalityGradientTheme,
} from './gradient-factory';

export type PersonalityGradientConfig = PersonalityGradientTheme;

/**
 * Legacy export retained for compatibility.
 * Values are now derived from the canonical GradientFactory source.
 */
export const PERSONALITY_GRADIENTS: Record<string, PersonalityGradientConfig> = {
    ...PERSONALITY_GRADIENT_THEMES,
    ...Object.fromEntries(
        Object.entries(GRADIENT_PERSONALITY_ALIASES).map(([legacyId, personalityId]) => [
            legacyId,
            resolvePersonalityGradientTheme(personalityId),
        ])
    ),
};

/**
 * Get gradient configuration for a personality or legacy palette id.
 */
export function getPersonalityGradients(
    paletteName: string
): PersonalityGradientConfig {
    return resolvePersonalityGradientTheme(paletteName);
}

/**
 * Generate CSS variable object from gradient config.
 */
export function generateGradientVariables(
    config: PersonalityGradientConfig
): Record<string, string> {
    return createGradientVariablesFromTheme(config);
}
