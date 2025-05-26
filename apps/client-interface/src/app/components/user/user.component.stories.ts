import type { Meta, StoryObj } from '@storybook/angular';
import { UserComponent } from './user.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<UserComponent> = {
  component: UserComponent,
  title: 'UserComponent',
};
export default meta;
type Story = StoryObj<UserComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/user works!/gi)).toBeTruthy();
  },
};
