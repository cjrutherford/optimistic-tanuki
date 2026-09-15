import type { Meta, StoryObj } from '@storybook/angular';
import { IconComponent, IconName } from './icon.component';

const sample: IconName[] = [
  'search',
  'home',
  'settings',
  'person',
  'notifications',
  'favorite',
  'chat',
  'share',
  'edit',
  'delete',
  'visibility',
  'verified',
  'location',
  'work',
  'email',
  'phone',
  'calendar',
  'image',
  'video',
  'link',
  'tag',
  'bookmark',
  'flag',
  'check',
  'close',
  'menu',
  'more-vertical',
  'arrow-back',
  'arrow-forward',
  'add',
  'remove',
  'filter',
  'sort',
  'refresh',
];

const meta: Meta<IconComponent> = {
  component: IconComponent,
  title: 'Primitives/Icon',
  tags: ['autodocs'],
  args: { name: 'search', size: 24, strokeWidth: 2 },
  argTypes: {
    name: { control: 'select', options: sample },
    size: { control: { type: 'range', min: 12, max: 64, step: 4 } },
  },
};

export default meta;
type Story = StoryObj<IconComponent>;

export const Default: Story = {};

export const Gallery: Story = {
  render: () => ({
    props: { sample },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; color: var(--foreground)">
        @for (name of sample; track name) {
          <div style="display: grid; justify-items: center; gap: 6px; padding: 12px; border: 1px solid var(--border); border-radius: var(--border-radius-md)">
            <otui-icon [name]="name" [size]="24" stroke="currentColor" />
            <code style="font-size: 0.75rem">{{ name }}</code>
          </div>
        }
      </div>`,
  }),
};
