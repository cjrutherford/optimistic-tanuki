import type { Meta, StoryObj } from '@storybook/angular';
import { ParticleVeilComponent } from './particle-veil.component';

const meta: Meta<ParticleVeilComponent> = {
  component: ParticleVeilComponent,
  title: 'Motion/Particle Veil',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 24,
    speed: 1,
    intensity: 0.6,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<ParticleVeilComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 14,
    speed: 0.7,
    intensity: 0.4,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 36,
    speed: 1.35,
    intensity: 0.86,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
  },
};
