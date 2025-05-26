import type { Meta, StoryObj } from '@storybook/angular';
import { ConfirmBlockComponent } from './confirm-block.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ConfirmBlockComponent> = {
  component: ConfirmBlockComponent,
  title: 'ConfirmBlockComponent',
};
export default meta;
type Story = StoryObj<ConfirmBlockComponent>;

export const Primary: Story = {
  args: {
    confirmHeader: 'Confirm Your Email',
    confirmMessage: 'Please confirm your email address by clicking the link we sent to your email. If you did not receive the email, you can resend it below.',
  },
};

export const Heading: Story = {
  args: {
    confirmHeader: 'Confirm Your Email',
    confirmMessage: 'Please confirm your email address by clicking the link we sent to your email. If you did not receive the email, you can resend it below.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Confirm Your Email/gi)).toBeTruthy();
  },
};
