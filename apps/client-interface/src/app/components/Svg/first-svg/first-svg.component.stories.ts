import type { Meta, StoryObj } from '@storybook/angular';
import { FirstSvgComponent } from './first-svg.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<FirstSvgComponent> = {
  component: FirstSvgComponent,
  title: 'FirstSvgComponent',
};
export default meta;
type Story = StoryObj<FirstSvgComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/first-svg works!/gi)).toBeTruthy();
  },
};
