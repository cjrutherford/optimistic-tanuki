import type { Meta, StoryObj } from '@storybook/angular';
import { ProfilePhotoComponent } from './profile-photo.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ProfilePhotoComponent> = {
  component: ProfilePhotoComponent,
  title: 'ProfilePhotoComponent',
};
export default meta;
type Story = StoryObj<ProfilePhotoComponent>;

export const Primary: Story = {
  args: {
    src: 'https://placehold.co/300x300',
  },
};

export const Heading: Story = {
  args: {
    src: 'https://placehold.co/300x300',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/profile-photo works!/gi)).toBeTruthy();
  },
};
