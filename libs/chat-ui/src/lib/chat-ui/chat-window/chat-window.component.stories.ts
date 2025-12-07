import type { Meta, StoryObj } from '@storybook/angular';
import { ChatWindowComponent } from './chat-window.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ChatWindowComponent> = {
  component: ChatWindowComponent,
  title: 'ChatWindowComponent',
};
export default meta;
type Story = StoryObj<ChatWindowComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/chat-window works!/gi)).toBeTruthy();
  },
};
