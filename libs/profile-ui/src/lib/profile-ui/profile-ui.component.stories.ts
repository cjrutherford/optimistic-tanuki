import type { Meta, StoryObj } from '@storybook/angular';
import { ProfileUiComponent } from './profile-ui.component';
import { expect, within } from '@storybook/test';

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
    await expect(canvas.getByText(/profile-ui works!/gi)).toBeTruthy();
  },
};
