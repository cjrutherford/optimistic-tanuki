import type { Meta, StoryObj } from '@storybook/angular';
import { CommentComponent } from './comment.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

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
    expect(canvas.getByText(/comment works!/gi)).toBeTruthy();
  },
};
