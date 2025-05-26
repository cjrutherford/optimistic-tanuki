import type { Meta, StoryObj } from '@storybook/angular';
import { GalleryComponent } from './gallery.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<GalleryComponent> = {
  component: GalleryComponent,
  title: 'GalleryComponent',
};
export default meta;
type Story = StoryObj<GalleryComponent>;

export const Primary: Story = {
  args: {
    data: {
      coverPhoto: 'https://placehold.it/300x300',
      title: 'Gallery',
    },
  },
};

export const Heading: Story = {
  args: {
    data: {
      coverPhoto: 'https://placehold.it/300x300',
      title: 'Gallery',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/gallery works!/gi)).toBeTruthy();
  },
};
