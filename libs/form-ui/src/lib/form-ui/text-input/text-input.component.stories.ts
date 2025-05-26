import type { Meta, StoryObj } from '@storybook/angular';
import { TextInputComponent } from './text-input.component';
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<TextInputComponent> = {
  component: TextInputComponent,
  title: 'TextInputComponent',
};
export default meta;
type Story = StoryObj<TextInputComponent>;

export const Primary: Story = {
  args: {
    label: 'Primary Input',
    type: 'text',
    value: 'Hello World',
    labelPosition: 'top',
  },
};

export const Password: Story = {
  args: {
    label: 'Password Input',
    type: 'password',
    value: '',
    labelPosition: 'left',
  },
};

export const Obscured: Story = {
  args: {
    label: 'Obscured Input',
    type: 'obscured',
    value: '',
    labelPosition: 'right',
  },
};

export const BottomLabel: Story = {
  args: {
    label: 'Bottom Label Input',
    type: 'text',
    value: '',
    labelPosition: 'bottom',
  },
};

export const Interaction: Story = {
  args: {
    label: 'Interactive Input',
    type: 'text',
    value: '',
    labelPosition: 'top',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Interactive Input');
    await userEvent.type(input, 'Testing Input');
    expect(input).toHaveValue('Testing Input');
  },
};
