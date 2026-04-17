import type { Meta, StoryObj } from '@storybook/angular';
import { TextAreaComponent } from './text-area.component';
import { expect, within } from '@storybook/test';

const meta: Meta<TextAreaComponent> = {
  component: TextAreaComponent,
  title: 'TextAreaComponent',
};
export default meta;
type Story = StoryObj<TextAreaComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/text-area works!/gi)).toBeTruthy();
  },
};
