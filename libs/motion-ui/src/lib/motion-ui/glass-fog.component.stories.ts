import type { Meta, StoryObj } from '@storybook/angular';
import { GlassFogComponent } from './glass-fog.component';

const meta: Meta<GlassFogComponent> = {
  component: GlassFogComponent,
  title: 'Motion/Glass Fog',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 4,
    speed: 1,
    intensity: 0.66,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<GlassFogComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 3,
    speed: 0.72,
    intensity: 0.46,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 6,
    speed: 1.22,
    intensity: 0.88,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    intensity: 0.56,
  },
};
