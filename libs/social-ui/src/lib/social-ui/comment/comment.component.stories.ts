import type { Meta, StoryObj } from '@storybook/angular';
import { CommentComponent } from './comment.component';
import { expect, within } from '@storybook/test';

const meta: Meta<CommentComponent> = {
  component: CommentComponent,
  title: 'CommentComponent',
};
export default meta;
type Story = StoryObj<CommentComponent>;

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/comment works!/gi)).toBeTruthy();
  },
};
