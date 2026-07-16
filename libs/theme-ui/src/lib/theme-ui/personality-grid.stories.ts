import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityGridComponent } from './personality-grid.component';

/**
 * "All 12 at a glance" comparison grid (Workstream D2). Renders the same
 * heading/body/button/card/input primitives across every predefined
 * personality, in both light and dark mode, so redundancy or font-loading
 * fallback is visible in review — see
 * `docs/design-system/personalities.md#distinctiveness-matrix` for the
 * numeric companion to this visual check.
 *
 * Unlike the other personality stories in this file, this one intentionally
 * does NOT use the global Storybook personality/mode toolbar
 * (`lib-storybook-theme-bridge`) — the whole point is to show every
 * personality and both modes simultaneously, which a single global selection
 * can't do. Each cell derives its own CSS variables directly from the
 * personality registry (see `personality-grid.component.ts`).
 */
const meta: Meta<PersonalityGridComponent> = {
  component: PersonalityGridComponent,
  title: 'Theme/Personality Grid (All 12)',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<PersonalityGridComponent>;

/** All 12 personalities, light and dark, side by side. */
export const AllPersonalities: Story = {
  args: {
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
  },
};

/** Light mode only, for a narrower/faster review pass. */
export const LightOnly: Story = {
  args: {
    modes: ['light'],
    primaryColor: '#3f51b5',
  },
};

/** Dark mode only. */
export const DarkOnly: Story = {
  args: {
    modes: ['dark'],
    primaryColor: '#3f51b5',
  },
};

/**
 * `soft` vs `soft-touch` were near-duplicates before Workstream B1 (see the
 * plan doc). This narrows the grid to exactly that pair, plus `foundation`'s
 * new flat/borderless/no-shadow/instant look against `classic` (the global
 * closest pair per the distinctiveness matrix), for a focused visual check.
 */
export const ClosestPairsFocus: Story = {
  args: {
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
    personalityIds: ['soft', 'soft-touch', 'classic', 'foundation'],
  },
};
