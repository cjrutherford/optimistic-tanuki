import type { Meta, StoryObj } from '@storybook/angular';
import { ThemeUiComponent } from './theme-ui.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ThemeUiComponent> = {
  component: ThemeUiComponent,
  title: 'ThemeUiComponent',
};
export default meta;
type Story = StoryObj<ThemeUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/theme-ui works!/gi)).toBeTruthy();
  },
};
