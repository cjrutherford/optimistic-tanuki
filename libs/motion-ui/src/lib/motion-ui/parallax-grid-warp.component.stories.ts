import type { Meta, StoryObj } from '@storybook/angular';
import { ParallaxGridWarpComponent } from './parallax-grid-warp.component';

const meta: Meta<ParallaxGridWarpComponent> = {
  component: ParallaxGridWarpComponent,
  title: 'Motion/Parallax Grid Warp',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 6,
    speed: 1,
    intensity: 0.7,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<ParallaxGridWarpComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 5,
    speed: 0.72,
    intensity: 0.48,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 8,
    speed: 1.35,
    intensity: 0.9,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    intensity: 0.58,
  },
};
