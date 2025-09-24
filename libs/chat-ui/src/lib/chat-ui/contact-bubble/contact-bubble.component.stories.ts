import type { Meta, StoryObj } from '@storybook/angular';
import { ContactBubbleComponent } from './contact-bubble.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ContactBubbleComponent> = {
  component: ContactBubbleComponent,
  title: 'ContactBubbleComponent',
};
export default meta;
type Story = StoryObj<ContactBubbleComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/contact-bubble works!/gi)).toBeTruthy();
  },
};
