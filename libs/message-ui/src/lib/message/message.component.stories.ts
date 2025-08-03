import type { Meta, StoryObj } from '@storybook/angular';

import { MessageComponent } from './message.component';
import { expect } from '@storybook/jest';
import { within } from '@storybook/testing-library';

const meta: Meta<MessageComponent> = {
  component: MessageComponent,
  title: 'MessageComponent',
};
export default meta;
type Story = StoryObj<MessageComponent>;

export const Primary: Story = {
  args: {
    messages: [{
      content: 'Message works!',
      type: 'info',
    },{
      content: 'Message works!',
      type: 'warning',
    },{
      content: 'Message works!',
      type: 'error',
    },{
      content: 'Message works!',
      type: 'success',
    }],
  },
};

export const Heading: Story = {
  args: {
    messages: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/message works!/gi)).toBeTruthy();
  },
};
