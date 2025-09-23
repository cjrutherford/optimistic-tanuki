import type { Meta, StoryObj } from '@storybook/angular';
import { FormUiComponent } from './form-ui.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<FormUiComponent> = {
  component: FormUiComponent,
  title: 'FormUiComponent',
};
export default meta;
type Story = StoryObj<FormUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/form-ui works!/gi)).toBeTruthy();
  },
};
