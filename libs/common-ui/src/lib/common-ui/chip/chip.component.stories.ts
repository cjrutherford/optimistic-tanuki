import type { Meta, StoryObj } from '@storybook/angular';
import { ChipComponent } from './chip.component';

const meta: Meta<ChipComponent> = {
  component: ChipComponent,
  title: 'Primitives/Chip',
  tags: ['autodocs'],
  args: {
    tone: 'brand',
    emphasis: 'soft',
    size: 'md',
    deletable: false,
    disabled: false,
  },
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
    delete: { action: 'delete' },
  },
  render: (args) => ({
    props: args,
    template: `<otui-chip [tone]="tone" [emphasis]="emphasis" [size]="size" [deletable]="deletable" [disabled]="disabled" (delete)="delete($event)">Design systems</otui-chip>`,
  }),
};

export default meta;
type Story = StoryObj<ChipComponent>;

export const Default: Story = {};

export const Deletable: Story = {
  args: { deletable: true },
};

export const Disabled: Story = {
  args: { deletable: true, disabled: true },
};

export const Emphases: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        @for (emphasis of ['solid', 'soft', 'outline', 'ghost']; track emphasis) {
          <otui-chip tone="brand" [emphasis]="emphasis">{{ emphasis }}</otui-chip>
        }
      </div>`,
  }),
};
