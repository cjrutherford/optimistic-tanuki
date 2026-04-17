import type { Meta, StoryObj } from '@storybook/angular';
import { PulseRingsComponent } from './pulse-rings.component';

const meta: Meta<PulseRingsComponent> = {
  component: PulseRingsComponent,
  title: 'Motion/Pulse Rings',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '24rem',
    ringCount: 4,
    speed: 1,
    intensity: 0.7,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<PulseRingsComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    ringCount: 3,
    speed: 0.7,
    intensity: 0.45,
  },
};

export const HighEnergy: Story = {
  args: {
    ringCount: 6,
    speed: 1.4,
    intensity: 0.92,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
  },
};
