import type { Meta, StoryObj } from '@storybook/angular';
import { AuthUiComponent } from './auth-ui.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

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
    expect(canvas.getByText(/auth-ui works!/gi)).toBeTruthy();
  },
};
