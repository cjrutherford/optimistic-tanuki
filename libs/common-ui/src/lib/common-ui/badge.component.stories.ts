import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
  component: BadgeComponent,
  title: 'Primitives/Badge',
  tags: ['autodocs'],
  args: { tone: 'neutral', emphasis: 'soft', size: 'md', icon: 'none' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'info', 'success', 'warning', 'danger', 'brand'],
    },
    emphasis: {
      control: 'select',
      options: ['solid', 'soft', 'outline', 'ghost'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    icon: {
      control: 'inline-radio',
      options: ['none', 'check', 'star', 'shield'],
    },
  },
  render: (args) => ({
    props: args,
    template: `<otui-badge [tone]="tone" [emphasis]="emphasis" [size]="size" [icon]="icon">Badge</otui-badge>`,
  }),
};

export default meta;
type Story = StoryObj<BadgeComponent>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => ({
    template: `
      <div style="display: grid; gap: 12px">
        @for (emphasis of ['solid', 'soft', 'outline', 'ghost']; track emphasis) {
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            @for (tone of ['neutral', 'info', 'success', 'warning', 'danger', 'brand']; track tone) {
              <otui-badge [tone]="tone" [emphasis]="emphasis">{{ tone }}</otui-badge>
            }
          </div>
        }
      </div>`,
  }),
};

export const WithIcon: Story = {
  args: { tone: 'success', emphasis: 'solid', icon: 'check' },
};
