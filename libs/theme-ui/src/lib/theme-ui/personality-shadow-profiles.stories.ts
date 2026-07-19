import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityTokenShowcaseComponent } from './personality-token-showcase.component';

/**
 * Workstream D4 (2026-07-18 personality-styles-refactor plan): the 7
 * `tokens.shadowProfile` shapes (`layered`/`diffuse`/`hard-offset`/`neon`/
 * `technical`/`minimal`/`playful-drop`) rendered across all 12
 * personalities, tinted per `colorGeneration.shadowTint` and mode-scaled
 * per `resolveShadowOpacity` — the same `generatePersonalityShadows()`
 * pipeline that produces the real `--shadow-sm/md/lg/xl` tokens (Workstream
 * B1/B2). See `docs/design-system/personalities.md#shadow-profiles` for the
 * numeric companion (which personality maps to which profile).
 *
 * Like `Theme/Personality Grid (All 12)`, this intentionally does NOT use
 * the global Storybook personality/mode toolbar — the point is to compare
 * every personality and both modes at once, which a single global selection
 * can't show.
 */
const meta: Meta<PersonalityTokenShowcaseComponent> = {
  component: PersonalityTokenShowcaseComponent,
  title: 'Theme/Personality Variation/Shadow Profiles',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<PersonalityTokenShowcaseComponent>;

/** All 12 personalities' shadow profiles, light and dark, side by side. */
export const AllProfiles: Story = {
  args: {
    variant: 'shadow-profiles',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
  },
};

/** Light mode only, for a narrower/faster review pass. */
export const LightOnly: Story = {
  args: {
    variant: 'shadow-profiles',
    modes: ['light'],
    primaryColor: '#3f51b5',
  },
};

/** Dark mode only — dark-mode shadow opacity is scaled up (B1); this makes
 * that scaling, and each profile's shape, easy to compare at a glance. */
export const DarkOnly: Story = {
  args: {
    variant: 'shadow-profiles',
    modes: ['dark'],
    primaryColor: '#3f51b5',
  },
};

/**
 * One personality per profile (`layered`, `minimal`, `playful-drop`,
 * `diffuse`, `hard-offset`, `neon`, `technical`) — the minimal set that
 * demonstrates all 7 shapes without the visual noise of 12 cells, several
 * of which share a profile.
 */
export const OnePerProfile: Story = {
  args: {
    variant: 'shadow-profiles',
    modes: ['light', 'dark'],
    primaryColor: '#3f51b5',
    personalityIds: [
      'classic', // layered
      'minimal', // minimal
      'bold', // playful-drop
      'elegant', // diffuse
      'architect', // hard-offset
      'electric', // neon
      'control-center', // technical
    ],
  },
};
