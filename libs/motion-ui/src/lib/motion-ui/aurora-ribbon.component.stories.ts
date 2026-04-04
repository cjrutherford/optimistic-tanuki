import type { Meta, StoryObj } from '@storybook/angular';
import { AuroraRibbonComponent } from './aurora-ribbon.component';

const meta: Meta<AuroraRibbonComponent> = {
  component: AuroraRibbonComponent,
  title: 'Motion/Aurora Ribbon',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    height: '28rem',
    density: 3,
    speed: 1,
    intensity: 0.72,
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<AuroraRibbonComponent>;

export const Default: Story = {};

export const Quiet: Story = {
  args: {
    density: 2,
    speed: 0.65,
    intensity: 0.42,
  },
};

export const HighEnergy: Story = {
  args: {
    density: 5,
    speed: 1.35,
    intensity: 0.92,
  },
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    intensity: 0.5,
  },
};
