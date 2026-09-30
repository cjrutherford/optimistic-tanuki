import type { Meta, StoryObj } from '@storybook/angular';
import { GridShiftComponent } from './grid-shift.component';

const meta: Meta<GridShiftComponent> = {
  component: GridShiftComponent,
  title: 'Grid Shift',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '24rem',
    density: 5,
    speed: 1,
    intensity: 0.7,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<GridShiftComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 3,
    speed: 0.6,
    intensity: 0.45,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 8,
    speed: 1.4,
    intensity: 0.95,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
  },
};
