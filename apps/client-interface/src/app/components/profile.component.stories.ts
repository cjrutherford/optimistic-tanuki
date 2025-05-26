import type { Meta, StoryObj } from '@storybook/angular';
import { ProfileComponent } from './profile.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ProfileComponent> = {
  component: ProfileComponent,
  title: 'ProfileComponent',
};
export default meta;
type Story = StoryObj<ProfileComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/profile works!/gi)).toBeTruthy();
  },
};
