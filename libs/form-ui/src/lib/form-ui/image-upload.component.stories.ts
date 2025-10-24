import type { Meta, StoryObj } from '@storybook/angular';
import { ImageUploadComponent } from './image-upload.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ImageUploadComponent> = {
  component: ImageUploadComponent,
  title: 'ImageUploadComponent',
};
export default meta;
type Story = StoryObj<ImageUploadComponent>;

export const Primary: Story = {
  args: {
    currentImage: null,
  },
};

export const Heading: Story = {
  args: {
    currentImage: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/image-upload works!/gi)).toBeTruthy();
  },
};
