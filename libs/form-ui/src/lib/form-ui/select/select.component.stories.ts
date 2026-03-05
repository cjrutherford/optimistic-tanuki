import type { Meta, StoryObj } from '@storybook/angular';
import { SelectComponent } from './select.component';
import { expect, within } from '@storybook/test';

const meta: Meta<SelectComponent> = {
  component: SelectComponent,
  title: 'SelectComponent',
};
export default meta;
type Story = StoryObj<SelectComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/select works!/gi)).toBeTruthy();
  },
};
