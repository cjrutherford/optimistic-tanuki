import type { Meta, StoryObj } from '@storybook/angular';
import { SignalMeshComponent } from './signal-mesh.component';

const meta: Meta<SignalMeshComponent> = {
  component: SignalMeshComponent,
  title: 'Motion/Signal Mesh',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 5,
    speed: 1,
    intensity: 0.68,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<SignalMeshComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 4,
    speed: 0.7,
    intensity: 0.48,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 7,
    speed: 1.35,
    intensity: 0.9,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    intensity: 0.56,
  },
};
