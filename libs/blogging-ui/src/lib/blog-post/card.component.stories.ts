import { componentWrapperDecorator, type Meta, type StoryObj } from '@storybook/angular';
import { BlogPostCardComponent } from './card.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<BlogPostCardComponent> = {
  component: BlogPostCardComponent,
  title: 'BlogPostCardComponent',
};
export default meta;
type Story = StoryObj<BlogPostCardComponent>;

export const Primary: Story = {
  args: {
    title: 'A Blog Post Title',
    bannerImage:
      'https://picsum.photos/600/200',
    excerpt:
      'This is a short excerpt from the blog post to give readers an idea of the content.',
    authorName: 'Author Name',
    publishDate: 'January 1, 2024',
    readMoreLink: '#',
  },
  decorators: [
    componentWrapperDecorator((story) => `<div style="width: 600px; margin: auto;">${story}</div>`),
  ],
};

export const Heading: Story = {
  args: {
    title: 'A Blog Post Title',
    bannerImage:
      'https://picsum.photos/600/200',
    excerpt:
      'This is a short excerpt from the blog post to give readers an idea of the content.',
    authorName: 'Author Name',
    publishDate: 'January 1, 2024',
    readMoreLink: '#',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/card works!/gi)).toBeTruthy();
  },
};
