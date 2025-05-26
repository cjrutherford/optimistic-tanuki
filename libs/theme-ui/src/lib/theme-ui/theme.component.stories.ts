import type { Meta, StoryObj } from '@storybook/angular';
import { ThemeToggleComponent } from './theme.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ThemeToggleComponent> = {
  component: ThemeToggleComponent,
  title: 'ToggleComponent',
};
export default meta;
type Story = StoryObj<ThemeToggleComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/theme works!/gi)).toBeTruthy();
  },
};