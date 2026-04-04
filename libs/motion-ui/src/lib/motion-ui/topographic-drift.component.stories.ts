import type { Meta, StoryObj } from '@storybook/angular';
import { TopographicDriftComponent } from './topographic-drift.component';

const meta: Meta<TopographicDriftComponent> = {
  component: TopographicDriftComponent,
  title: 'Motion/Topographic Drift',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 6,
    speed: 1,
    intensity: 0.64,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<TopographicDriftComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 5,
    speed: 0.72,
    intensity: 0.46,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 9,
    speed: 1.4,
    intensity: 0.86,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    intensity: 0.54,
  },
};
