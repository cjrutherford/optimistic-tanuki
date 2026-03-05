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

export interface PersonalityGradientTheme {
  primary: string;
  secondary: string;
  tertiary: string;
  surface: string;
  glow: string;
  border: string;
  text: string;
  animated?: string;
  buttonHover?: string;
  cardHeader?: string;
  modalOverlay?: string;
  inputFocus?: string;
  surfaceElevated?: string;
}

export const PERSONALITY_GRADIENT_THEMES: Record<
  string,
  PersonalityGradientTheme
> = {
  classic: {
    primary: 'linear-gradient(138deg, #2f3fa8 0%, #4b64c0 46%, #7688da 100%)',
    secondary: 'linear-gradient(142deg, #37474f 0%, #546e7a 55%, #78909c 100%)',
    tertiary: 'linear-gradient(142deg, #5f56b5 0%, #7e66c6 52%, #a28bd6 100%)',
    surface: 'linear-gradient(180deg, #fbfcff 0%, #f2f5fb 52%, #ebf0f8 100%)',
    glow: 'radial-gradient(circle at 50% 35%, rgba(73, 101, 198, 0.30) 0%, rgba(73, 101, 198, 0.10) 42%, transparent 75%)',
    border: 'linear-gradient(128deg, #3753b3 0%, #6076c7 55%, #7e93d6 100%)',
    text: 'linear-gradient(126deg, #27358c 0%, #3f51b5 60%, #5c6fc6 100%)',
    animated: 'linear-gradient(120deg, #2f3fa8, #4b64c0, #6076c7, #7688da)',
    buttonHover: 'linear-gradient(128deg, #4057bd 0%, #5f77d1 52%, #8799df 100%)',
    cardHeader: 'linear-gradient(180deg, #3042a5 0%, #4f67bf 60%, #6f84d4 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(34, 53, 112, 0.56) 0%, rgba(45, 66, 140, 0.46) 52%, rgba(61, 83, 160, 0.38) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(80, 108, 210, 0.42) 0%, rgba(80, 108, 210, 0.18) 45%, transparent 76%)',
    surfaceElevated: 'linear-gradient(165deg, #ffffff 0%, #f5f8ff 56%, #edf2fb 100%)',
  },
  minimal: {
    primary: 'linear-gradient(180deg, #111111 0%, #222222 60%, #2d2d2d 100%)',
    secondary: 'linear-gradient(180deg, #5a5a5a 0%, #707070 58%, #878787 100%)',
    tertiary: 'linear-gradient(180deg, #2d333b 0%, #404853 56%, #566171 100%)',
    surface: 'linear-gradient(180deg, #ffffff 0%, #fbfbfb 54%, #f4f4f4 100%)',
    glow: 'radial-gradient(circle at 50% 50%, rgba(20, 20, 20, 0.12) 0%, rgba(20, 20, 20, 0.05) 42%, transparent 78%)',
    border: 'linear-gradient(180deg, #e8e8e8 0%, #d6d6d6 100%)',
    text: 'linear-gradient(180deg, #141414 0%, #2e2e2e 100%)',
    animated: 'linear-gradient(180deg, #f9f9f9, #f2f2f2, #ececec, #f6f6f6)',
    buttonHover: 'linear-gradient(180deg, #202020 0%, #2f2f2f 100%)',
    cardHeader: 'linear-gradient(180deg, #f8f8f8 0%, #eeeeee 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(10, 10, 10, 0.52) 0%, rgba(20, 20, 20, 0.44) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(15, 15, 15, 0.24) 0%, rgba(15, 15, 15, 0.08) 45%, transparent 80%)',
    surfaceElevated: 'linear-gradient(180deg, #ffffff 0%, #f9f9f9 62%, #f0f0f0 100%)',
  },
  bold: {
    primary: 'linear-gradient(112deg, #ff2d00 0%, #ff5e00 30%, #ff7f3a 64%, #ffc107 100%)',
    secondary: 'linear-gradient(116deg, #00d66f 0%, #22f2a6 42%, #00e5ff 100%)',
    tertiary: 'linear-gradient(302deg, #4f00d1 0%, #7d2bff 40%, #b45cff 100%)',
    surface: 'linear-gradient(172deg, #fff2de 0%, #ffe0b4 55%, #ffd18b 100%)',
    glow: 'radial-gradient(circle at 45% 30%, rgba(255, 66, 0, 0.52) 0%, rgba(255, 66, 0, 0.24) 36%, rgba(0, 230, 118, 0.15) 56%, transparent 80%)',
    border: 'linear-gradient(120deg, #ff2d00 0%, #ff9a00 48%, #00d66f 100%)',
    text: 'linear-gradient(110deg, #b71c1c 0%, #ff3d00 48%, #ff8f00 100%)',
    animated: 'linear-gradient(95deg, #ff2d00, #ff6a00, #ff9a00, #00d66f, #00e5ff)',
    buttonHover: 'linear-gradient(120deg, #ff5000 0%, #ff7a00 44%, #ffba00 100%)',
    cardHeader: 'linear-gradient(180deg, #ff6b00 0%, #ff4200 58%, #da1a00 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(94, 25, 0, 0.56) 0%, rgba(152, 40, 0, 0.44) 46%, rgba(40, 60, 10, 0.34) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(255, 110, 20, 0.48) 0%, rgba(255, 60, 0, 0.24) 38%, transparent 76%)',
    surfaceElevated: 'linear-gradient(158deg, #fff8eb 0%, #ffe7c7 52%, #ffd6a7 100%)',
  },
  soft: {
    primary: 'linear-gradient(144deg, #ffd4e6 0%, #f7b9dd 45%, #e8b9f5 100%)',
    secondary: 'linear-gradient(146deg, #d8f2ff 0%, #b6e8ff 46%, #a8d7ff 100%)',
    tertiary: 'linear-gradient(142deg, #e5defc 0%, #cfc4f5 48%, #bda9ea 100%)',
    surface: 'linear-gradient(180deg, #fffafc 0%, #fff4fa 52%, #f9f6ff 100%)',
    glow: 'radial-gradient(circle at 50% 40%, rgba(239, 179, 223, 0.42) 0%, rgba(195, 221, 255, 0.20) 46%, transparent 80%)',
    border: 'linear-gradient(135deg, #f6c7e2 0%, #c8defb 56%, #c8c2f1 100%)',
    text: 'linear-gradient(132deg, #a84f88 0%, #b965a2 54%, #8f7ac6 100%)',
    animated: 'linear-gradient(120deg, #ffd4e6, #f2b9dc, #d1e8ff, #c8c3f4)',
    buttonHover: 'linear-gradient(142deg, #fbc5e0 0%, #e6b7ef 50%, #c2ccf8 100%)',
    cardHeader: 'linear-gradient(180deg, #f6d8ea 0%, #eecdf0 60%, #ddd9f9 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(133, 88, 131, 0.42) 0%, rgba(150, 105, 170, 0.30) 56%, rgba(120, 130, 190, 0.24) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(223, 177, 232, 0.44) 0%, rgba(198, 214, 255, 0.24) 46%, transparent 80%)',
    surfaceElevated: 'linear-gradient(165deg, #ffffff 0%, #fef8fc 54%, #f5f2fd 100%)',
  },
  professional: {
    primary: 'linear-gradient(132deg, #0f4ea5 0%, #1a69c5 52%, #2e7fd8 100%)',
    secondary: 'linear-gradient(132deg, #4a5d6a 0%, #5f7381 56%, #788d9a 100%)',
    tertiary: 'linear-gradient(132deg, #5a2f8e 0%, #7440a3 52%, #8b56b8 100%)',
    surface: 'linear-gradient(180deg, #f8fafc 0%, #eef2f6 48%, #e4ebf1 100%)',
    glow: 'radial-gradient(circle at 50% 35%, rgba(26, 102, 193, 0.28) 0%, rgba(26, 102, 193, 0.11) 45%, transparent 78%)',
    border: 'linear-gradient(130deg, #1a69c5 0%, #3f86d2 52%, #637e91 100%)',
    text: 'linear-gradient(125deg, #0c3e88 0%, #1565c0 56%, #2b78cd 100%)',
    animated: 'linear-gradient(110deg, #0f4ea5, #1a69c5, #2e7fd8, #5f7381)',
    buttonHover: 'linear-gradient(128deg, #1d60ba 0%, #2b79d4 54%, #4a8fdf 100%)',
    cardHeader: 'linear-gradient(180deg, #edf3f9 0%, #dfe9f2 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(20, 45, 78, 0.54) 0%, rgba(28, 62, 106, 0.46) 56%, rgba(40, 80, 130, 0.34) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(45, 113, 203, 0.40) 0%, rgba(45, 113, 203, 0.17) 46%, transparent 80%)',
    surfaceElevated: 'linear-gradient(164deg, #ffffff 0%, #f3f7fb 56%, #e7edf4 100%)',
  },
  playful: {
    primary: 'linear-gradient(106deg, #ff3a95 0%, #ff5d66 30%, #ff9a2f 62%, #ffe74a 100%)',
    secondary: 'linear-gradient(112deg, #00d9ff 0%, #00ffd0 42%, #64ff8f 100%)',
    tertiary: 'linear-gradient(112deg, #8b5cff 0%, #b56dff 44%, #ff6bcf 100%)',
    surface: 'linear-gradient(172deg, #fffdf0 0%, #fff5ca 50%, #ffeac0 100%)',
    glow: 'radial-gradient(circle at 48% 30%, rgba(255, 74, 153, 0.50) 0%, rgba(255, 154, 47, 0.24) 42%, rgba(0, 233, 255, 0.16) 62%, transparent 82%)',
    border: 'linear-gradient(116deg, #ff3a95 0%, #ff8e3d 40%, #00d9ff 100%)',
    text: 'linear-gradient(110deg, #c2185b 0%, #ff3a95 42%, #ff8f00 100%)',
    animated: 'linear-gradient(90deg, #ff3a95, #ff6f61, #ffb347, #00d9ff, #64ff8f, #b56dff)',
    buttonHover: 'linear-gradient(112deg, #ff4f9c 0%, #ff7f5c 42%, #ffd24f 100%)',
    cardHeader: 'linear-gradient(180deg, #ffe36e 0%, #ff9a7a 52%, #ff5fbf 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(118, 32, 91, 0.50) 0%, rgba(196, 74, 74, 0.34) 44%, rgba(44, 110, 146, 0.26) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(255, 90, 130, 0.44) 0%, rgba(0, 224, 255, 0.24) 45%, transparent 80%)',
    surfaceElevated: 'linear-gradient(160deg, #ffffff 0%, #fff8d9 58%, #ffefd0 100%)',
  },
  elegant: {
    primary: 'linear-gradient(142deg, #4e2f26 0%, #6d4c41 44%, #9c7b67 100%)',
    secondary: 'linear-gradient(146deg, #a96a00 0%, #c68a17 46%, #e2b75d 100%)',
    tertiary: 'linear-gradient(142deg, #3b2621 0%, #5a3d36 50%, #7d5a50 100%)',
    surface: 'linear-gradient(180deg, #fffdf8 0%, #f7efe0 52%, #eee2cf 100%)',
    glow: 'radial-gradient(circle at 52% 34%, rgba(150, 110, 84, 0.34) 0%, rgba(150, 110, 84, 0.15) 44%, transparent 78%)',
    border: 'linear-gradient(136deg, #70473b 0%, #8f6252 46%, #c4923c 100%)',
    text: 'linear-gradient(128deg, #2f1f1b 0%, #5a3c34 54%, #8d6e63 100%)',
    animated: 'linear-gradient(120deg, #4e2f26, #6d4c41, #a17a50, #d6b06a)',
    buttonHover: 'linear-gradient(140deg, #5e382d 0%, #815948 50%, #b3885d 100%)',
    cardHeader: 'linear-gradient(180deg, #e8d3b3 0%, #cda472 54%, #a3794f 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(42, 28, 24, 0.58) 0%, rgba(70, 47, 37, 0.44) 52%, rgba(96, 70, 49, 0.34) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(154, 118, 83, 0.42) 0%, rgba(154, 118, 83, 0.19) 46%, transparent 80%)',
    surfaceElevated: 'linear-gradient(160deg, #ffffff 0%, #f8f1e6 58%, #eddfc9 100%)',
  },
  architect: {
    primary: 'repeating-linear-gradient(135deg, #121212 0 16px, #2a2a2a 16px 32px, #3f3f3f 32px 48px)',
    secondary: 'linear-gradient(120deg, #ef4b20 0%, #ff6a3d 48%, #ff8a62 100%)',
    tertiary: 'linear-gradient(130deg, #4f6672 0%, #6f8794 54%, #8ea4b1 100%)',
    surface: 'linear-gradient(180deg, #212121 0%, #181818 55%, #101010 100%)',
    glow: 'radial-gradient(circle at 56% 36%, rgba(255, 98, 48, 0.38) 0%, rgba(255, 98, 48, 0.14) 44%, transparent 82%)',
    border: 'repeating-linear-gradient(90deg, #383838 0 6px, #ff5c2f 6px 12px)',
    text: 'linear-gradient(120deg, #f5f5f5 0%, #d4d4d4 52%, #a7a7a7 100%)',
    animated: 'repeating-linear-gradient(120deg, #161616 0 14px, #2d2d2d 14px 28px, #ff5b2f 28px 42px, #556a76 42px 56px)',
    buttonHover: 'repeating-linear-gradient(120deg, #202020 0 12px, #343434 12px 24px, #ff5c2f 24px 36px)',
    cardHeader: 'linear-gradient(180deg, #343434 0%, #262626 64%, #1b1b1b 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(8, 8, 8, 0.72) 0%, rgba(26, 26, 26, 0.62) 52%, rgba(45, 32, 26, 0.52) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(255, 93, 47, 0.46) 0%, rgba(255, 93, 47, 0.18) 42%, transparent 80%)',
    surfaceElevated: 'linear-gradient(156deg, #2c2c2c 0%, #222222 52%, #181818 100%)',
  },
  'soft-touch': {
    primary: 'linear-gradient(144deg, #ffd8ca 0%, #ffc4b5 42%, #ffb39b 100%)',
    secondary: 'linear-gradient(142deg, #d1f0ea 0%, #b9e6dc 48%, #9cd7cb 100%)',
    tertiary: 'linear-gradient(142deg, #efe3db 0%, #ddcdc0 50%, #c7b2a1 100%)',
    surface: 'linear-gradient(180deg, #fffdfb 0%, #fdf5ef 52%, #f6ece3 100%)',
    glow: 'radial-gradient(circle at 50% 40%, rgba(255, 200, 177, 0.44) 0%, rgba(194, 231, 221, 0.20) 50%, transparent 82%)',
    border: 'linear-gradient(135deg, #ffcdbf 0%, #f0d7c8 44%, #bde2d8 100%)',
    text: 'linear-gradient(130deg, #934d35 0%, #b4664b 52%, #6f8a80 100%)',
    animated: 'linear-gradient(120deg, #ffd8ca, #ffbfaa, #d3efe8, #f0ddd0)',
    buttonHover: 'linear-gradient(140deg, #ffcab7 0%, #ffb49a 50%, #eacdb8 100%)',
    cardHeader: 'linear-gradient(180deg, #ffe9df 0%, #f6dacd 56%, #eacdc0 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(116, 78, 68, 0.42) 0%, rgba(153, 106, 92, 0.30) 56%, rgba(118, 134, 126, 0.24) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(255, 188, 164, 0.42) 0%, rgba(194, 230, 222, 0.24) 48%, transparent 82%)',
    surfaceElevated: 'linear-gradient(164deg, #ffffff 0%, #fff7f2 54%, #f5ece2 100%)',
  },
  electric: {
    primary: 'linear-gradient(104deg, #ff006a 0%, #ff2d95 26%, #ff6a00 58%, #ffe000 100%)',
    secondary: 'linear-gradient(112deg, #00f0ff 0%, #00b8ff 42%, #7f5bff 100%)',
    tertiary: 'linear-gradient(112deg, #36ff7f 0%, #00ffd5 46%, #00d5ff 100%)',
    surface: 'linear-gradient(180deg, #18091b 0%, #1f1031 55%, #24143d 100%)',
    glow: 'radial-gradient(circle at 50% 32%, rgba(255, 0, 106, 0.56) 0%, rgba(255, 115, 0, 0.30) 36%, rgba(0, 229, 255, 0.20) 60%, transparent 84%)',
    border: 'linear-gradient(110deg, #ff006a 0%, #ff8a00 42%, #00e5ff 100%)',
    text: 'linear-gradient(106deg, #ff4ec4 0%, #ff8f3d 46%, #fff27a 100%)',
    animated: 'linear-gradient(88deg, #ff006a, #ff2d95, #ff6a00, #ffe000, #00e5ff, #7f5bff)',
    buttonHover: 'linear-gradient(112deg, #ff2a7d 0%, #ff7a2f 46%, #ffd93f 100%)',
    cardHeader: 'linear-gradient(180deg, #2f0a48 0%, #4f0d74 46%, #7b1097 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(19, 6, 33, 0.74) 0%, rgba(43, 10, 72, 0.64) 46%, rgba(80, 18, 120, 0.52) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(255, 52, 139, 0.50) 0%, rgba(0, 224, 255, 0.28) 48%, transparent 82%)',
    surfaceElevated: 'linear-gradient(158deg, #251035 0%, #31164a 56%, #3f1d5d 100%)',
  },
  'control-center': {
    primary: 'linear-gradient(118deg, #00a8bf 0%, #00bfd8 40%, #00e5ff 100%)',
    secondary: 'linear-gradient(124deg, #ff8f00 0%, #ffb300 44%, #ffd54f 100%)',
    tertiary: 'linear-gradient(124deg, #7cb342 0%, #9ccc65 50%, #c5e1a5 100%)',
    surface: 'linear-gradient(180deg, #0f1527 0%, #101c35 46%, #13294a 100%)',
    glow: 'radial-gradient(circle at 52% 34%, rgba(0, 213, 255, 0.38) 0%, rgba(0, 213, 255, 0.16) 44%, transparent 82%)',
    border: 'linear-gradient(122deg, #00b5cf 0%, #00d2ff 46%, #ffb300 100%)',
    text: 'linear-gradient(114deg, #9ff2ff 0%, #6ed8ff 44%, #ffe082 100%)',
    animated: 'linear-gradient(95deg, #00a8bf, #00d2ff, #7cb342, #ffb300, #00e5ff)',
    buttonHover: 'linear-gradient(122deg, #00b8cf 0%, #00dcff 52%, #78c8ff 100%)',
    cardHeader: 'linear-gradient(180deg, #102137 0%, #16324f 58%, #1c4469 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(7, 13, 25, 0.74) 0%, rgba(13, 27, 48, 0.64) 50%, rgba(20, 46, 80, 0.52) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(0, 210, 255, 0.44) 0%, rgba(0, 210, 255, 0.18) 44%, transparent 82%)',
    surfaceElevated: 'linear-gradient(160deg, #15253f 0%, #193153 56%, #1d3e66 100%)',
  },
  foundation: {
    primary: 'linear-gradient(134deg, #1f79d4 0%, #3f95e5 54%, #6ab5f1 100%)',
    secondary: 'linear-gradient(136deg, #7f929d 0%, #9faeb6 56%, #c2ccd2 100%)',
    tertiary: 'linear-gradient(136deg, #6f7fc6 0%, #8ea0d7 54%, #b4bfe4 100%)',
    surface: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 52%, #eff4f8 100%)',
    glow: 'radial-gradient(circle at 50% 34%, rgba(63, 149, 229, 0.28) 0%, rgba(63, 149, 229, 0.12) 44%, transparent 80%)',
    border: 'linear-gradient(138deg, #dbe3ea 0%, #c5d0d8 56%, #a9b8c1 100%)',
    text: 'linear-gradient(126deg, #155fae 0%, #2479c7 56%, #4394da 100%)',
    animated: 'linear-gradient(118deg, #fefefe, #f5f9fc, #eaf1f7, #dbe7f0)',
    buttonHover: 'linear-gradient(132deg, #2b84dd 0%, #4ea0ea 56%, #77bdf4 100%)',
    cardHeader: 'linear-gradient(180deg, #eef4f8 0%, #e3edf4 100%)',
    modalOverlay: 'linear-gradient(to bottom, rgba(16, 42, 74, 0.52) 0%, rgba(25, 63, 106, 0.40) 54%, rgba(38, 85, 137, 0.28) 100%)',
    inputFocus: 'radial-gradient(circle at 50% 50%, rgba(68, 145, 219, 0.38) 0%, rgba(68, 145, 219, 0.16) 46%, transparent 82%)',
    surfaceElevated: 'linear-gradient(165deg, #ffffff 0%, #f4f8fb 58%, #e8eff5 100%)',
  },
};

export const GRADIENT_PERSONALITY_ALIASES: Record<string, string> = {
  'optimistic-blue': 'classic',
  'electric-sunset': 'electric',
  'forest-dream': 'soft-touch',
  'cyberpunk-neon': 'electric',
  'royal-purple': 'elegant',
  'ocean-breeze': 'foundation',
  'retro-gaming': 'playful',
  'minimal-monochrome': 'minimal',
};

export type ThemeGradientInput = Pick<
  ThemeColors,
  'accent' | 'complementary' | 'tertiary' | 'background' | 'foreground'
>;

interface PersonalityGradientRecipe {
  primaryAngle: string;
  secondaryAngle: string;
  tertiaryAngle: string;
  surfaceAngle: string;
  animatedAngle: string;
  borderAngle: string;
  textAngle: string;
  saturationShift: number;
  lightnessShift: number;
  contrastShift: number;
  surfaceAccentMix: number;
  surfaceSecondaryMix: number;
  glowOpacity: number;
  overlayOpacity: number;
  repeatingPrimary?: boolean;
  repeatingBorder?: boolean;
}

const DEFAULT_DYNAMIC_COLORS: ThemeGradientInput = {
  accent: '#3f51b5',
  complementary: '#607d8b',
  tertiary: '#9575cd',
  background: '#ffffff',
  foreground: '#1f2937',
};

const PERSONALITY_GRADIENT_RECIPES: Record<string, PersonalityGradientRecipe> = {
  classic: {
    primaryAngle: '138deg',
    secondaryAngle: '142deg',
    tertiaryAngle: '140deg',
    surfaceAngle: '180deg',
    animatedAngle: '120deg',
    borderAngle: '128deg',
    textAngle: '126deg',
    saturationShift: 4,
    lightnessShift: 0,
    contrastShift: 8,
    surfaceAccentMix: 0.08,
    surfaceSecondaryMix: 0.06,
    glowOpacity: 0.34,
    overlayOpacity: 0.52,
  },
  minimal: {
    primaryAngle: '180deg',
    secondaryAngle: '180deg',
    tertiaryAngle: '180deg',
    surfaceAngle: '180deg',
    animatedAngle: '180deg',
    borderAngle: '180deg',
    textAngle: '180deg',
    saturationShift: -36,
    lightnessShift: -8,
    contrastShift: 4,
    surfaceAccentMix: 0.03,
    surfaceSecondaryMix: 0.02,
    glowOpacity: 0.2,
    overlayOpacity: 0.48,
  },
  bold: {
    primaryAngle: '112deg',
    secondaryAngle: '116deg',
    tertiaryAngle: '302deg',
    surfaceAngle: '172deg',
    animatedAngle: '95deg',
    borderAngle: '120deg',
    textAngle: '110deg',
    saturationShift: 22,
    lightnessShift: 4,
    contrastShift: 16,
    surfaceAccentMix: 0.18,
    surfaceSecondaryMix: 0.14,
    glowOpacity: 0.52,
    overlayOpacity: 0.58,
  },
  soft: {
    primaryAngle: '144deg',
    secondaryAngle: '146deg',
    tertiaryAngle: '142deg',
    surfaceAngle: '180deg',
    animatedAngle: '120deg',
    borderAngle: '135deg',
    textAngle: '132deg',
    saturationShift: -10,
    lightnessShift: 18,
    contrastShift: -4,
    surfaceAccentMix: 0.1,
    surfaceSecondaryMix: 0.08,
    glowOpacity: 0.42,
    overlayOpacity: 0.44,
  },
  professional: {
    primaryAngle: '132deg',
    secondaryAngle: '132deg',
    tertiaryAngle: '132deg',
    surfaceAngle: '180deg',
    animatedAngle: '110deg',
    borderAngle: '130deg',
    textAngle: '125deg',
    saturationShift: 0,
    lightnessShift: -2,
    contrastShift: 10,
    surfaceAccentMix: 0.09,
    surfaceSecondaryMix: 0.07,
    glowOpacity: 0.34,
    overlayOpacity: 0.54,
  },
  playful: {
    primaryAngle: '106deg',
    secondaryAngle: '112deg',
    tertiaryAngle: '112deg',
    surfaceAngle: '172deg',
    animatedAngle: '90deg',
    borderAngle: '116deg',
    textAngle: '110deg',
    saturationShift: 18,
    lightnessShift: 10,
    contrastShift: 12,
    surfaceAccentMix: 0.16,
    surfaceSecondaryMix: 0.12,
    glowOpacity: 0.52,
    overlayOpacity: 0.5,
  },
  elegant: {
    primaryAngle: '142deg',
    secondaryAngle: '146deg',
    tertiaryAngle: '142deg',
    surfaceAngle: '180deg',
    animatedAngle: '120deg',
    borderAngle: '136deg',
    textAngle: '128deg',
    saturationShift: -8,
    lightnessShift: -2,
    contrastShift: 14,
    surfaceAccentMix: 0.11,
    surfaceSecondaryMix: 0.1,
    glowOpacity: 0.36,
    overlayOpacity: 0.56,
  },
  architect: {
    primaryAngle: '135deg',
    secondaryAngle: '120deg',
    tertiaryAngle: '130deg',
    surfaceAngle: '180deg',
    animatedAngle: '120deg',
    borderAngle: '90deg',
    textAngle: '120deg',
    saturationShift: -18,
    lightnessShift: -12,
    contrastShift: 20,
    surfaceAccentMix: 0.1,
    surfaceSecondaryMix: 0.08,
    glowOpacity: 0.4,
    overlayOpacity: 0.68,
    repeatingPrimary: true,
    repeatingBorder: true,
  },
  'soft-touch': {
    primaryAngle: '144deg',
    secondaryAngle: '142deg',
    tertiaryAngle: '142deg',
    surfaceAngle: '180deg',
    animatedAngle: '120deg',
    borderAngle: '135deg',
    textAngle: '130deg',
    saturationShift: -6,
    lightnessShift: 20,
    contrastShift: -2,
    surfaceAccentMix: 0.1,
    surfaceSecondaryMix: 0.08,
    glowOpacity: 0.44,
    overlayOpacity: 0.42,
  },
  electric: {
    primaryAngle: '104deg',
    secondaryAngle: '112deg',
    tertiaryAngle: '112deg',
    surfaceAngle: '180deg',
    animatedAngle: '88deg',
    borderAngle: '110deg',
    textAngle: '106deg',
    saturationShift: 28,
    lightnessShift: 2,
    contrastShift: 20,
    surfaceAccentMix: 0.22,
    surfaceSecondaryMix: 0.16,
    glowOpacity: 0.58,
    overlayOpacity: 0.72,
  },
  'control-center': {
    primaryAngle: '118deg',
    secondaryAngle: '124deg',
    tertiaryAngle: '124deg',
    surfaceAngle: '180deg',
    animatedAngle: '95deg',
    borderAngle: '122deg',
    textAngle: '114deg',
    saturationShift: 8,
    lightnessShift: -8,
    contrastShift: 16,
    surfaceAccentMix: 0.14,
    surfaceSecondaryMix: 0.1,
    glowOpacity: 0.42,
    overlayOpacity: 0.7,
  },
  foundation: {
    primaryAngle: '134deg',
    secondaryAngle: '136deg',
    tertiaryAngle: '136deg',
    surfaceAngle: '180deg',
    animatedAngle: '118deg',
    borderAngle: '138deg',
    textAngle: '126deg',
    saturationShift: -2,
    lightnessShift: 2,
    contrastShift: 10,
    surfaceAccentMix: 0.08,
    surfaceSecondaryMix: 0.06,
    glowOpacity: 0.34,
    overlayOpacity: 0.5,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const sanitized = (hex || '').trim();
  const normalized = sanitized.startsWith('#') ? sanitized.slice(1) : sanitized;
  const expanded =
    normalized.length === 3
      ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (component: number) =>
    clamp(Math.round(component), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgbObject(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hn < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hn < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hn < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hn < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hn < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return rgbToHex(
    (rPrime + m) * 255,
    (gPrime + m) * 255,
    (bPrime + m) * 255
  );
}

function shiftColor(
  hex: string,
  {
    hue = 0,
    saturation = 0,
    lightness = 0,
  }: { hue?: number; saturation?: number; lightness?: number }
): string {
  const hsl = hexToHsl(hex);
  return hslToHex(
    hsl.h + hue,
    hsl.s + saturation,
    hsl.l + lightness
  );
}

function mixHex(colorA: string, colorB: string, ratio: number): string {
  const safeRatio = clamp(ratio, 0, 1);
  const a = hexToRgbObject(colorA);
  const b = hexToRgbObject(colorB);
  return rgbToHex(
    a.r * (1 - safeRatio) + b.r * safeRatio,
    a.g * (1 - safeRatio) + b.g * safeRatio,
    a.b * (1 - safeRatio) + b.b * safeRatio
  );
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgbObject(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(2)})`;
}

function buildPersonalityGradientTheme(
  personalityId: string,
  inputColors: ThemeGradientInput
): PersonalityGradientTheme {
  const recipe =
    PERSONALITY_GRADIENT_RECIPES[personalityId] ||
    PERSONALITY_GRADIENT_RECIPES['classic'];

  const accentBase = shiftColor(inputColors.accent, {
    saturation: recipe.saturationShift,
    lightness: recipe.lightnessShift,
  });
  const accentDeep = shiftColor(inputColors.accent, {
    saturation: recipe.saturationShift + 4,
    lightness: -(10 + recipe.contrastShift),
  });
  const accentSoft = shiftColor(inputColors.accent, {
    saturation: recipe.saturationShift - 6,
    lightness: 14 + Math.max(0, recipe.lightnessShift),
  });

  const secondaryBase = shiftColor(inputColors.complementary, {
    saturation: recipe.saturationShift - 2,
    lightness: recipe.lightnessShift,
  });
  const secondarySoft = shiftColor(inputColors.complementary, {
    saturation: recipe.saturationShift - 8,
    lightness: 14,
  });

  const tertiaryBase = shiftColor(inputColors.tertiary, {
    saturation: recipe.saturationShift,
    lightness: recipe.lightnessShift,
  });
  const tertiarySoft = shiftColor(inputColors.tertiary, {
    saturation: recipe.saturationShift - 8,
    lightness: 14,
  });

  const surfaceTop = mixHex(
    inputColors.background,
    accentBase,
    recipe.surfaceAccentMix
  );
  const surfaceMid = mixHex(
    inputColors.background,
    secondaryBase,
    recipe.surfaceSecondaryMix
  );
  const surfaceBottom = mixHex(inputColors.background, inputColors.foreground, 0.06);

  const borderMid = mixHex(accentBase, secondaryBase, 0.5);
  const textEnd = mixHex(accentDeep, inputColors.foreground, 0.35);
  const overlayBase = mixHex(inputColors.foreground, accentDeep, 0.35);

  const primary = recipe.repeatingPrimary
    ? `repeating-linear-gradient(${recipe.primaryAngle}, ${accentDeep} 0 14px, ${accentBase} 14px 28px, ${accentSoft} 28px 42px)`
    : `linear-gradient(${recipe.primaryAngle}, ${accentDeep} 0%, ${accentBase} 52%, ${accentSoft} 100%)`;

  const border = recipe.repeatingBorder
    ? `repeating-linear-gradient(${recipe.borderAngle}, ${accentDeep} 0 8px, ${borderMid} 8px 16px)`
    : `linear-gradient(${recipe.borderAngle}, ${accentDeep} 0%, ${borderMid} 54%, ${secondaryBase} 100%)`;

  return {
    primary,
    secondary: `linear-gradient(${recipe.secondaryAngle}, ${secondaryBase} 0%, ${mixHex(
      secondaryBase,
      tertiaryBase,
      0.35
    )} 54%, ${secondarySoft} 100%)`,
    tertiary: `linear-gradient(${recipe.tertiaryAngle}, ${tertiaryBase} 0%, ${mixHex(
      tertiaryBase,
      accentBase,
      0.25
    )} 50%, ${tertiarySoft} 100%)`,
    surface: `linear-gradient(${recipe.surfaceAngle}, ${surfaceTop} 0%, ${surfaceMid} 54%, ${surfaceBottom} 100%)`,
    glow: `radial-gradient(circle at 50% 35%, ${withAlpha(
      accentBase,
      recipe.glowOpacity
    )} 0%, ${withAlpha(accentBase, recipe.glowOpacity * 0.42)} 42%, transparent 82%)`,
    border,
    text: `linear-gradient(${recipe.textAngle}, ${accentDeep} 0%, ${textEnd} 100%)`,
    animated: `linear-gradient(${recipe.animatedAngle}, ${accentDeep}, ${accentBase}, ${secondaryBase}, ${tertiaryBase}, ${accentSoft})`,
    buttonHover: `linear-gradient(${recipe.primaryAngle}, ${accentBase} 0%, ${mixHex(
      accentBase,
      secondaryBase,
      0.35
    )} 55%, ${accentSoft} 100%)`,
    cardHeader: `linear-gradient(180deg, ${mixHex(accentDeep, surfaceTop, 0.2)} 0%, ${mixHex(
      accentBase,
      surfaceMid,
      0.45
    )} 60%, ${surfaceMid} 100%)`,
    modalOverlay: `linear-gradient(to bottom, ${withAlpha(
      overlayBase,
      recipe.overlayOpacity
    )} 0%, ${withAlpha(
      overlayBase,
      recipe.overlayOpacity * 0.78
    )} 56%, ${withAlpha(overlayBase, recipe.overlayOpacity * 0.58)} 100%)`,
    inputFocus: `radial-gradient(circle at 50% 50%, ${withAlpha(
      accentBase,
      recipe.glowOpacity * 0.9
    )} 0%, ${withAlpha(
      accentBase,
      recipe.glowOpacity * 0.42
    )} 46%, transparent 82%)`,
    surfaceElevated: `linear-gradient(165deg, ${mixHex(
      inputColors.background,
      accentSoft,
      recipe.surfaceAccentMix * 0.7
    )} 0%, ${mixHex(
      inputColors.background,
      secondarySoft,
      recipe.surfaceSecondaryMix * 0.8
    )} 58%, ${surfaceBottom} 100%)`,
  };
}

export function normalizePersonalityId(personalityId: string): string {
  return (personalityId || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function resolvePersonalityGradientTheme(
  personalityId: string,
  colors?: ThemeGradientInput
): PersonalityGradientTheme {
  const normalized = normalizePersonalityId(personalityId);
  const resolvedId =
    GRADIENT_PERSONALITY_ALIASES[normalized] ||
    (PERSONALITY_GRADIENT_THEMES[normalized] ? normalized : 'classic');

  if (colors) {
    return buildPersonalityGradientTheme(resolvedId, colors);
  }

  return buildPersonalityGradientTheme(resolvedId, DEFAULT_DYNAMIC_COLORS);
}

export function createGradientVariablesFromTheme(
  gradients: PersonalityGradientTheme
): Record<string, string> {
  const animated = gradients.animated || gradients.primary;
  const cardHeader =
    gradients.cardHeader ||
    gradients.primary.replace('135deg', '180deg').replace('100%)', '90%)');
  const buttonHover = gradients.buttonHover || gradients.primary;
  const modalOverlay =
    gradients.modalOverlay ||
    (gradients.surface.includes('180deg')
      ? gradients.surface.replace('180deg', 'to bottom')
      : gradients.surface);
  const inputFocus = gradients.inputFocus || gradients.glow;
  const surfaceElevated = gradients.surfaceElevated || gradients.surface;

  return {
    '--gradient-primary': gradients.primary,
    '--gradient-secondary': gradients.secondary,
    '--gradient-tertiary': gradients.tertiary,
    '--gradient-surface': gradients.surface,
    '--gradient-glow': gradients.glow,
    '--gradient-border': gradients.border,
    '--gradient-text': gradients.text,
    '--gradient-animated': animated,
    '--gradient-card-header': cardHeader,
    '--gradient-button-hover': buttonHover,
    '--gradient-modal-overlay': modalOverlay,
    '--gradient-input-focus': inputFocus,
    '--gradient-surface-elevated': surfaceElevated,

    '--primary-gradient': gradients.primary,
    '--secondary-gradient': gradients.secondary,
    '--tertiary-gradient': gradients.tertiary,
    '--surface-gradient': gradients.surface,
    '--gradient-dark': gradients.primary,
    '--gradient-light': gradients.secondary,
    '--gradient-fastCycle': animated,
  };
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
    this.strategies.set('architect', this.createArchitectStrategy());
    this.strategies.set('soft-touch', this.createSoftTouchStrategy());
    this.strategies.set('electric', this.createElectricStrategy());
    this.strategies.set('control-center', this.createControlCenterStrategy());
    this.strategies.set('foundation', this.createFoundationStrategy());
  }

  getPersonalityGradients(personalityId: string): PersonalityGradientTheme {
    return resolvePersonalityGradientTheme(personalityId);
  }

  createGradientVariables(
    personalityId: string,
    colors?: ThemeGradientInput
  ): Record<string, string> {
    return createGradientVariablesFromTheme(
      resolvePersonalityGradientTheme(personalityId, colors)
    );
  }

  getPersonalityGradientsFromColors(
    personalityId: string,
    colors: ThemeGradientInput
  ): PersonalityGradientTheme {
    return resolvePersonalityGradientTheme(personalityId, colors);
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
    const gradients = this.getPersonalityGradientsFromColors(personalityId, {
      accent: colors.accent,
      complementary: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });

    if (!strategy.appliesTo.buttons) {
      return 'none';
    }

    switch (variant) {
      case 'primary':
        return gradients.primary;
      case 'secondary':
        return gradients.secondary;
      default:
        return 'none';
    }
  }

  createCardGradient(
    colors: ThemeColors,
    personalityId: string,
    variant: 'elevated' | 'glass' | 'flat' | 'gradient'
  ): string {
    const strategy = this.getStrategy(personalityId);
    const gradients = this.getPersonalityGradientsFromColors(personalityId, {
      accent: colors.accent,
      complementary: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });

    if (!strategy.appliesTo.cards || variant === 'flat') {
      return 'none';
    }

    switch (variant) {
      case 'gradient':
      case 'elevated':
        return gradients.surface;
      case 'glass':
        return `linear-gradient(to bottom, rgba(${this.hexToRgb(
          colors.accent
        )}, 0.12), rgba(${this.hexToRgb(colors.complementary)}, 0.06))`;
      default:
        return 'none';
    }
  }

  createHeaderGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);
    const gradients = this.getPersonalityGradientsFromColors(personalityId, {
      accent: colors.accent,
      complementary: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });

    if (!strategy.appliesTo.headers) {
      return 'none';
    }

    return gradients.text;
  }

  createBackgroundGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);
    const gradients = this.getPersonalityGradientsFromColors(personalityId, {
      accent: colors.accent,
      complementary: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });

    if (!strategy.appliesTo.backgrounds) {
      return 'none';
    }

    return gradients.surface;
  }

  createBorderGradient(colors: ThemeColors, personalityId: string): string {
    const strategy = this.getStrategy(personalityId);
    const gradients = this.getPersonalityGradientsFromColors(personalityId, {
      accent: colors.accent,
      complementary: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });

    if (!strategy.appliesTo.borders) {
      return 'none';
    }

    return gradients.border;
  }

  private buildGradient(config: GradientConfig, colors: ThemeColors): string {
    const resolvedColors = this.resolveColors(config.colors, colors);
    const stopsStr = config.stops ? `, ${config.stops.join('%, ')}%` : '';

    let gradient = '';

    switch (config.type) {
      case 'linear':
        gradient = `linear-gradient(${config.direction ?? '90deg'
          }, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'conic':
        gradient = `conic-gradient(from ${config.direction ?? '0deg'
          } at 50% 50%, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'radial':
        gradient = `radial-gradient(ellipse at center, ${resolvedColors.join(
          ', '
        )}${stopsStr})`;
        break;
      case 'repeating-linear':
        gradient = `repeating-linear-gradient(${config.direction ?? '90deg'
          }, ${resolvedColors.join(', ')}${stopsStr})`;
        break;
      case 'repeating-conic':
        gradient = `repeating-conic-gradient(from ${config.direction ?? '0deg'
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

  private createArchitectStrategy(): PersonalityGradientStrategy {
    return {
      ...this.createBoldStrategy(),
      id: 'architect',
      name: 'Architect',
      animationEasing: 'linear',
    };
  }

  private createSoftTouchStrategy(): PersonalityGradientStrategy {
    return {
      ...this.createSoftStrategy(),
      id: 'soft-touch',
      name: 'Soft Touch',
    };
  }

  private createElectricStrategy(): PersonalityGradientStrategy {
    return {
      ...this.createBoldStrategy(),
      id: 'electric',
      name: 'Electric',
      animationDuration: '220ms',
    };
  }

  private createControlCenterStrategy(): PersonalityGradientStrategy {
    return {
      ...this.createProfessionalStrategy(),
      id: 'control-center',
      name: 'Control Center',
      appliesTo: {
        buttons: true,
        cards: true,
        headers: true,
        backgrounds: true,
        borders: true,
        badges: true,
      },
    };
  }

  private createFoundationStrategy(): PersonalityGradientStrategy {
    return {
      ...this.createClassicStrategy(),
      id: 'foundation',
      name: 'Foundation',
      prefersAnimation: false,
      animationDuration: '180ms',
    };
  }
}
