import type { Meta, StoryObj } from '@storybook/angular';
import { MfaBlockComponent } from './mfa-block.component';
import { within, userEvent } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<MfaBlockComponent> = {
  component: MfaBlockComponent,
  title: 'MfaBlockComponent',
};
export default meta;
type Story = StoryObj<MfaBlockComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/On-board MFA Token/gi)).toBeTruthy();
  },
};

export const SubmitToken: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/MFA Token:/i);
    await userEvent.type(input, '123456');
    const submitButton = canvas.getByRole('button', { name: /Submit/i });
    await userEvent.click(submitButton);
    await expect(console.log).toHaveBeenCalledWith('MFA Token Submitted:', '123456');
  },
};

export const Onboarding: Story = {
  args: {
    onboarding: true,
    qrCodeUrl: 'https://example.com/qrcode.png',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Scan the QR Code/gi)).toBeTruthy();
    await expect(canvas.getByAltText(/QR Code/gi)).toBeTruthy();
  },
};
