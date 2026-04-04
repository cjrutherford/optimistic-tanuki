import type { Meta, StoryObj } from '@storybook/angular';
import { ShimmerBeamComponent } from './shimmer-beam.component';

const meta: Meta<ShimmerBeamComponent> = {
  component: ShimmerBeamComponent,
  title: 'Motion/Shimmer Beam',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '20rem',
    speed: 1,
    intensity: 0.65,
    reducedMotion: false,
    direction: 'diagonal',
  },
};

export default meta;
type Story = StoryObj<ShimmerBeamComponent>;

export const Default: Story = {};

export const Horizontal: Story = {
  args: {
    direction: 'horizontal',
  },
};

export const HighEnergy: Story = {
  args: {
    speed: 1.5,
    intensity: 0.9,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
  },
};
