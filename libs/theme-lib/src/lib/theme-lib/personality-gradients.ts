/**
 * Personality-specific gradient configurations
 * Each personality has gradients that match its aesthetic
 */

export interface PersonalityGradientConfig {
  primary: string; // Main accent gradient
  secondary: string; // Complementary gradient
  tertiary: string; // Third color gradient
  surface: string; // Background/surface gradient
  glow: string; // Glow effect gradient
  border: string; // Border gradient
  text: string; // Text gradient (for headings)
  animated?: string; // Optional animated gradient
}

export const PERSONALITY_GRADIENTS: Record<string, PersonalityGradientConfig> =
  {
    // Optimistic Blue - Calm, professional, trustworthy
    'optimistic-blue': {
      primary: 'linear-gradient(135deg, #3f51b5 0%, #5c6bc0 50%, #7986cb 100%)',
      secondary:
        'linear-gradient(135deg, #c0af4b 0%, #d4c66a 50%, #e8dc89 100%)',
      tertiary:
        'linear-gradient(135deg, #7e57c2 0%, #9575cd 50%, #b39ddb 100%)',
      surface: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
      glow: 'radial-gradient(circle, rgba(63, 81, 181, 0.3) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #3f51b5, #c0af4b)',
      text: 'linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%)',
      animated: 'linear-gradient(45deg, #3f51b5, #5c6bc0, #7986cb, #c0af4b)',
    },

    // Electric Sunset - Energetic, warm, vibrant
    'electric-sunset': {
      primary: 'linear-gradient(135deg, #ff6b35 0%, #ff8a65 50%, #ffab91 100%)',
      secondary:
        'linear-gradient(135deg, #359dff 0%, #64b5f6 50%, #90caf9 100%)',
      tertiary:
        'linear-gradient(135deg, #ff35a6 0%, #f06292 50%, #f48fb1 100%)',
      surface: 'linear-gradient(180deg, #fafafa 0%, #ffe0b2 100%)',
      glow: 'radial-gradient(circle, rgba(255, 107, 53, 0.4) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #ff6b35, #359dff)',
      text: 'linear-gradient(135deg, #ff6b35 0%, #ff8a65 100%)',
      animated: 'linear-gradient(45deg, #ff6b35, #ff8a65, #359dff, #64b5f6)',
    },

    // Forest Dream - Natural, calming, organic
    'forest-dream': {
      primary: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 50%, #66bb6a 100%)',
      secondary:
        'linear-gradient(135deg, #8e2476 0%, #af4c95 50%, #ba68c8 100%)',
      tertiary:
        'linear-gradient(135deg, #e65100 0%, #ff9800 50%, #ffb74d 100%)',
      surface: 'linear-gradient(180deg, #f1f8e9 0%, #dcedc8 100%)',
      glow: 'radial-gradient(circle, rgba(46, 125, 50, 0.3) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #2e7d32, #8e2476)',
      text: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
      animated: 'linear-gradient(45deg, #2e7d32, #4caf50, #8e2476, #af4c95)',
    },

    // Cyberpunk Neon - Futuristic, edgy, bold
    'cyberpunk-neon': {
      primary: 'linear-gradient(135deg, #00ffff 0%, #00e5ff 50%, #00b8d4 100%)',
      secondary:
        'linear-gradient(135deg, #ff00ff 0%, #e040fb 50%, #ea80fc 100%)',
      tertiary:
        'linear-gradient(135deg, #ffff00 0%, #ffeb3b 50%, #fff176 100%)',
      surface: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
      glow: 'radial-gradient(circle, rgba(0, 255, 255, 0.5) 0%, rgba(255, 0, 255, 0.3) 50%, transparent 70%)',
      border: 'linear-gradient(135deg, #00ffff, #ff00ff)',
      text: 'linear-gradient(135deg, #00ffff 0%, #ff00ff 100%)',
      animated: 'linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff)',
    },

    // Royal Purple - Elegant, sophisticated, luxurious
    'royal-purple': {
      primary: 'linear-gradient(135deg, #673ab7 0%, #7e57c2 50%, #9575cd 100%)',
      secondary:
        'linear-gradient(135deg, #ffc107 0%, #ffd54f 50%, #ffe082 100%)',
      tertiary:
        'linear-gradient(135deg, #e91e63 0%, #f06292 50%, #f48fb1 100%)',
      surface: 'linear-gradient(180deg, #faf8ff 0%, #f3e5f5 100%)',
      glow: 'radial-gradient(circle, rgba(103, 58, 183, 0.3) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #673ab7, #ffc107)',
      text: 'linear-gradient(135deg, #4a148c 0%, #673ab7 100%)',
      animated: 'linear-gradient(45deg, #673ab7, #7e57c2, #ffc107, #ffd54f)',
    },

    // Ocean Breeze - Cool, refreshing, peaceful
    'ocean-breeze': {
      primary: 'linear-gradient(135deg, #006064 0%, #0097a7 50%, #00bcd4 100%)',
      secondary:
        'linear-gradient(135deg, #d84315 0%, #ff7043 50%, #ff8a65 100%)',
      tertiary:
        'linear-gradient(135deg, #00838f 0%, #26c6da 50%, #4dd0e1 100%)',
      surface: 'linear-gradient(180deg, #e0f2f1 0%, #b2dfdb 100%)',
      glow: 'radial-gradient(circle, rgba(0, 96, 100, 0.3) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #006064, #d84315)',
      text: 'linear-gradient(135deg, #004d40 0%, #006064 100%)',
      animated: 'linear-gradient(45deg, #006064, #0097a7, #d84315, #ff7043)',
    },

    // Retro Gaming - Nostalgic, fun, pixel-art inspired
    'retro-gaming': {
      primary: 'linear-gradient(135deg, #e91e63 0%, #ec407a 50%, #f06292 100%)',
      secondary:
        'linear-gradient(135deg, #1ee963 0%, #4caf50 50%, #81c784 100%)',
      tertiary:
        'linear-gradient(135deg, #63e91e 0%, #8bc34a 50%, #aed581 100%)',
      surface: 'linear-gradient(180deg, #fff3e0 0%, #ffe0b2 100%)',
      glow: 'radial-gradient(circle, rgba(233, 30, 99, 0.4) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #e91e63, #1ee963)',
      text: 'linear-gradient(135deg, #bf360c 0%, #e91e63 100%)',
      animated: 'linear-gradient(45deg, #e91e63, #ec407a, #1ee963, #4caf50)',
    },

    // Minimal Monochrome - Clean, modern, professional
    'minimal-monochrome': {
      primary: 'linear-gradient(135deg, #424242 0%, #616161 50%, #757575 100%)',
      secondary:
        'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 50%, #eeeeee 100%)',
      tertiary:
        'linear-gradient(135deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)',
      surface: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
      glow: 'radial-gradient(circle, rgba(66, 66, 66, 0.2) 0%, transparent 70%)',
      border: 'linear-gradient(135deg, #424242, #bdbdbd)',
      text: 'linear-gradient(135deg, #212121 0%, #424242 100%)',
      animated: 'linear-gradient(45deg, #424242, #616161, #2196f3, #42a5f5)',
    },
  };

/**
 * Get gradient configuration for a palette
 */
export function getPersonalityGradients(
  paletteName: string
): PersonalityGradientConfig {
  const normalizedName = paletteName.toLowerCase().replace(/\s+/g, '-');
  return (
    PERSONALITY_GRADIENTS[normalizedName] ||
    PERSONALITY_GRADIENTS['optimistic-blue']
  );
}

/**
 * Generate CSS variable object from gradient config
 */
export function generateGradientVariables(
  config: PersonalityGradientConfig
): Record<string, string> {
  return {
    '--gradient-primary': config.primary,
    '--gradient-secondary': config.secondary,
    '--gradient-tertiary': config.tertiary,
    '--gradient-surface': config.surface,
    '--gradient-glow': config.glow,
    '--gradient-border': config.border,
    '--gradient-text': config.text,
    '--gradient-animated': config.animated || config.primary,
  };
}
