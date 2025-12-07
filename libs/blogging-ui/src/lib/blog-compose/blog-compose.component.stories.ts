import type { Meta, StoryObj } from '@storybook/angular';
import { BlogComposeComponent } from './blog-compose.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<BlogComposeComponent> = {
  component: BlogComposeComponent,
  title: 'BlogComposeComponent',
};
export default meta;
type Story = StoryObj<BlogComposeComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/blog-compose works!/gi)).toBeTruthy();
  },
};
