import type { Meta, StoryObj } from '@storybook/angular';
import { LoginComponent } from './login.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<LoginComponent> = {
  component: LoginComponent,
  title: 'LoginComponent',
};
export default meta;
type Story = StoryObj<LoginComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/login works!/gi)).toBeTruthy();
  },
};
