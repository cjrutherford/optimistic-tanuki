import type { Meta, StoryObj } from '@storybook/angular';
import { CommentListComponent } from './comment-list.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<CommentListComponent> = {
  component: CommentListComponent,
  title: 'CommentListComponent',
};
export default meta;
type Story = StoryObj<CommentListComponent>;

export const Primary: Story = {
  args: {
    comments: [
      {
        userId: 'user1',
        id: '1',
        content: 'This is the first comment.',
        postId: '1',
        profileId: ''
      },
      {
        userId: 'user3',
        id: '4',
        content: 'This is the second comment.',
        postId: '1',
        profileId: ''
      },
    ],
  },
};

export const Heading: Story = {
  args: {
    comments: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/comment-list works!/gi)).toBeTruthy();
  },
};
