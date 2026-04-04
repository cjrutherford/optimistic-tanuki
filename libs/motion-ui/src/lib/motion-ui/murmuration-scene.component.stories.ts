import type { Meta, StoryObj } from '@storybook/angular';
import { MurmurationSceneComponent } from './murmuration-scene.component';

const meta: Meta<MurmurationSceneComponent> = {
  component: MurmurationSceneComponent,
  title: 'Motion/Murmuration Scene',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    count: 48,
    speed: 0.35,
    height: '28rem',
    reducedMotion: false,
  },
};

export default meta;
type Story = StoryObj<MurmurationSceneComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 32px; min-height: 100vh; background: var(--background);">
        <otui-murmuration-scene
          [count]="count"
          [speed]="speed"
          [height]="height"
          [reducedMotion]="reducedMotion"
        />
      </div>
    `,
  }),
};

export const ReducedMotion: Story = {
  args: {
    reducedMotion: true,
    height: '22rem',
  },
};
