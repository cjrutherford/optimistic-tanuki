import type { Meta, StoryObj } from '@storybook/angular';
import { ChatUiComponent } from './chat-ui.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ChatUiComponent> = {
  component: ChatUiComponent,
  title: 'ChatUiComponent',
};
export default meta;
type Story = StoryObj<ChatUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/chat-ui works!/gi)).toBeTruthy();
  },
};
