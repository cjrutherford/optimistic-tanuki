import type { Meta, StoryObj } from '@storybook/angular';
import { DropdownComponent } from './dropdown.component';

const meta: Meta<DropdownComponent> = {
  component: DropdownComponent,
  title: 'Primitives/Dropdown',
  tags: ['autodocs'],
  args: { triggerLabel: 'Actions', disabled: false },
  argTypes: {
    open: { action: 'open' },
    close: { action: 'close' },
  },
  parameters: { layout: 'centered' },
  render: (args) => ({
    props: args,
    template: `
      <otui-dropdown [triggerLabel]="triggerLabel" [disabled]="disabled" (open)="open($event)" (close)="close($event)">
        <div style="display: grid; padding: 8px; min-width: 160px">
          <button type="button">Rename</button>
          <button type="button">Duplicate</button>
          <button type="button">Archive</button>
        </div>
      </otui-dropdown>`,
  }),
};

export default meta;
type Story = StoryObj<DropdownComponent>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
