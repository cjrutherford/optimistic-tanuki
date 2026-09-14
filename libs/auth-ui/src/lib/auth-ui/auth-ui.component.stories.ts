import type { Meta, StoryObj } from '@storybook/angular';
import { AuthUiComponent } from './auth-ui.component';
import { expect, within } from '@storybook/test';

const meta: Meta<AuthUiComponent> = {
  component: AuthUiComponent,
  title: 'AuthUiComponent',
};
export default meta;
type Story = StoryObj<AuthUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/auth-ui works!/gi)).toBeTruthy();
  },
};
