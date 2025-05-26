import type { Meta, StoryObj } from '@storybook/angular';
import { FriendsComponent } from './friends.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<FriendsComponent> = {
  component: FriendsComponent,
  title: 'FriendsComponent',
};
export default meta;
type Story = StoryObj<FriendsComponent>;

export const Primary: Story = {
  args: {
    friend: {
      photo: 'https://placehold.it/300x300',
      name: 'Friend',
    },
  },
};

export const Heading: Story = {
  args: {
    friend: {
      photo: 'https://placehold.it/300x300',
      name: 'Friend',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/friends works!/gi)).toBeTruthy();
  },
};
