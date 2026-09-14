import type { Meta, StoryObj } from '@storybook/angular';
import { BloggingUiComponent } from './blogging-ui.component';
import { expect, within } from '@storybook/test';

const meta: Meta<BloggingUiComponent> = {
  component: BloggingUiComponent,
  title: 'BloggingUiComponent',
};
export default meta;
type Story = StoryObj<BloggingUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/blogging-ui works!/gi)).toBeTruthy();
  },
};
