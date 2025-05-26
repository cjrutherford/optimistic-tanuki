import type { Meta, StoryObj } from '@storybook/angular';
import { AttachmentComponent } from './attachment.component';
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<AttachmentComponent> = {
  component: AttachmentComponent,
  title: 'AttachmentComponent',
};
export default meta;
type Story = StoryObj<AttachmentComponent>;

export const Primary: Story = {
  args: {
    attachments: [
      new File([''], 'file1.txt', { type: 'text/plain' }),
      new File([''], 'file2.jpg', { type: 'image/jpeg' }),
    ],
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/attachment works!/gi)).toBeTruthy();
  },
};

export const Interaction: Story = {
  args: {
    attachments: [
      new File([''], 'file1.txt', { type: 'text/plain' }),
      new File([''], 'file2.jpg', { type: 'image/jpeg' }),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('New attachment');
    const addButton = canvas.getByText('Add Attachment');

    await userEvent.type(input, 'file3.pdf');
    await userEvent.click(addButton);

    expect(canvas.getByText('file3.pdf')).toBeTruthy();
  },
};
