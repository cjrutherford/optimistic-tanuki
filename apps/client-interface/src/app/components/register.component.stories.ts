import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterComponent } from './register.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RegisterComponent> = {
  component: RegisterComponent,
  title: 'RegisterComponent',
};
export default meta;
type Story = StoryObj<RegisterComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/register works!/gi)).toBeTruthy();
  },
};
