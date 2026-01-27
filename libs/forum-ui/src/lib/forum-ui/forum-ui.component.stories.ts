import type { Meta, StoryObj } from '@storybook/angular';
import { ForumUiComponent } from './forum-ui.component';
import { expect } from 'storybook/test';

const meta: Meta<ForumUiComponent> = {
  component: ForumUiComponent,
  title: 'ForumUiComponent',
};
export default meta;

type Story = StoryObj<ForumUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/forum-ui/gi)).toBeTruthy();
  },
};
