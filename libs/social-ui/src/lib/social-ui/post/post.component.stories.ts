import type { Meta, StoryObj } from '@storybook/angular';
import { PostComponent } from './post.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { PostDto } from '../../models';

const meta: Meta<PostComponent> = {
  component: PostComponent,
  title: 'PostComponent',
};
export default meta;
type Story = StoryObj<PostComponent>;

const samplePost: PostDto = {
  id: '1',
  userId: '1',
  title: 'Sample Post',
  content: 'This is a sample post content.',
  attachments: [],
  profileId: '',
  comments: [
    {
      userId: 'User1', content: 'Great post!', id: '1', postId: '1',
      profileId: ''
    },
    {
      userId: 'User2', content: 'Thanks for sharing.', id: '2', postId: '1',
      profileId: ''
    },
  ],
  createdAt: new Date(),
};

export const Primary: Story = {
  args: {
    content: samplePost,
    attachments: [
      { id: '1', type: 'image', postId: '1', userId: '1', name: 'Attachment1', url: 'http://example.com/attachment1' },
      { id: '2', type: 'image', postId: '1', userId: '1', name: 'Attachment2', url: 'http://example.com/attachment2' }
    ],
    links: [
      { title: 'Link1', url: 'http://example.com/link1' },
      { title: 'Link2', url: 'http://example.com/link2' }
    ]
  },
};

export const Heading: Story = {
  args: {
    content: samplePost,
    attachments: [],
    links: []
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Sample Post/gi)).toBeTruthy();
  },
};
