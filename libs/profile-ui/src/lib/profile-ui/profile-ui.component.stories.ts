import type { Meta, StoryObj } from '@storybook/angular';
import { ProfileUiComponent } from './profile-ui.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ProfileUiComponent> = {
  component: ProfileUiComponent,
  title: 'ProfileUiComponent',
};
export default meta;
type Story = StoryObj<ProfileUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/profile-ui works!/gi)).toBeTruthy();
  },
};
