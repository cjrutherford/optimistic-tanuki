import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityTokenShowcaseComponent } from './personality-token-showcase.component';

/**
 * Workstream D4 (2026-07-18 personality-styles-refactor plan): each
 * personality's `pageBackground` SVG pattern (Workstream C1), rendered
 * through the same encode step `ThemeService` uses after the C0 fix
 * (`encodeURIComponent` + a single `'` replace — see
 * `encodeSvgBackground()` in `personality-token-showcase.component.ts`).
 * `classic` and `foundation` have no `pageBackground` by design and are
 * labeled "flat by design" rather than rendered as an (nonexistent) empty
 * pattern — see `docs/design-system/personalities.md#page-backgrounds`.
 *
 * For the actual full-viewport delivery mechanism (as opposed to this
 * side-by-side comparison swatch), see `<lib-personality-backdrop>`
 * (`personality-backdrop.component.ts`) and its own story/spec — it reads
 * `--page-background-pattern` from `ThemeService`'s global CSS variables
 * rather than computing its own, so it isn't a fit for a 12-across grid.
 *
 * Like `Theme/Personality Grid (All 12)`, this intentionally does NOT use
 * the global Storybook personality/mode toolbar.
 */
const meta: Meta<PersonalityTokenShowcaseComponent> = {
  component: PersonalityTokenShowcaseComponent,
  title: 'Theme/Personality Variation/Page Backgrounds',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<PersonalityTokenShowcaseComponent>;

/** All 12 personalities' page backgrounds, light and dark, side by side. */
export const AllBackgrounds: Story = {
  args: {
    variant: 'page-backgrounds',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
  },
};

/** Light mode only. */
export const LightOnly: Story = {
  args: {
    variant: 'page-backgrounds',
    modes: ['light'],
    primaryColor: '#3f51b5',
  },
};

/** Dark mode only — patterns are theme-responsive, so tint/luminosity
 * differ from the light-mode swatch above rather than just re-using it. */
export const DarkOnly: Story = {
  args: {
    variant: 'page-backgrounds',
    modes: ['dark'],
    primaryColor: '#3f51b5',
  },
};

/** The two documented flat personalities next to a patterned neighbor, to
 * make the "flat by design" distinction (intentional, not missing) obvious. */
export const FlatByDesignFocus: Story = {
  args: {
    variant: 'page-backgrounds',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
    personalityIds: ['classic', 'foundation', 'professional', 'control-center'],
  },
};
