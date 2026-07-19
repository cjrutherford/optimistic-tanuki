import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityTokenShowcaseComponent } from './personality-token-showcase.component';

/**
 * Workstream D4 (2026-07-18 personality-styles-refactor plan): background
 * vs surface vs elevated tiles per personality, demonstrating Workstream
 * E1's surface character (`surfaceHueBias`, `surfaceSaturationShift`, and
 * the now-spread `surfaceLuminosityOffset`, contrast auto-clamped per E3).
 * `surface` is the real `generateThemeResponsiveColors()` output;
 * `elevated` is the SAME function re-run with the personality's own
 * `surfaceLuminosityOffset` doubled (a demonstration of "elevation
 * contrast is itself a personality trait" — see the doc comment in
 * `personality-token-showcase.component.ts` for why there's no separate
 * production `--elevated` token to read from yet).
 *
 * Like `Theme/Personality Grid (All 12)`, this intentionally does NOT use
 * the global Storybook personality/mode toolbar.
 */
const meta: Meta<PersonalityTokenShowcaseComponent> = {
  component: PersonalityTokenShowcaseComponent,
  title: 'Theme/Personality Variation/Surfaces',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<PersonalityTokenShowcaseComponent>;

/** All 12 personalities' surface character, light and dark, side by side. */
export const AllSurfaces: Story = {
  args: {
    variant: 'surfaces',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
  },
};

/** Light mode only. */
export const LightOnly: Story = {
  args: {
    variant: 'surfaces',
    modes: ['light'],
    primaryColor: '#3f51b5',
  },
};

/** Dark mode only. */
export const DarkOnly: Story = {
  args: {
    variant: 'surfaces',
    modes: ['dark'],
    primaryColor: '#3f51b5',
  },
};

/**
 * Narrow, high-contrast focus set: `architect` (untinted, offset -5) and
 * `minimal` (near-flat, offset -1) at the low end of elevation drama,
 * against `playful` (warm-tinted, offset -7) and `electric` (primary-tinted,
 * offset -6) at the high end — the spread `surfaceLuminosityOffset` E1
 * introduced in place of the pre-E1 mostly-(-2) cluster.
 */
export const ElevationSpreadFocus: Story = {
  args: {
    variant: 'surfaces',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
    personalityIds: ['minimal', 'architect', 'electric', 'playful'],
  },
};

/**
 * Workstream C3 (2026-07-18 refactor plan, landed 2026-07-18): the curated
 * set of personalities that declare a `surfaceTexture` — the `surface` tile
 * renders it via `--surface-texture` (the same variable/encode path
 * `ThemeService` emits), on top of the E1 surface color character above.
 * `soft-touch` (paper grain), `control-center` (scanlines), `architect`
 * (sparse blueprint cross-hatch), and `electric` (angular circuit-trace
 * corner) are the only four; every other personality's `surface` tile
 * intentionally renders flat here — absence is the default, not a gap.
 */
export const TexturedSurfaces: Story = {
  args: {
    variant: 'surfaces',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
    personalityIds: ['soft-touch', 'control-center', 'architect', 'electric'],
  },
};
