import type { Meta, StoryObj } from '@storybook/angular';
import { SpinnerComponent } from './spinner.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<SpinnerComponent> = {
  component: SpinnerComponent,
  title: 'SpinnerComponent',
};
export default meta;
type Story = StoryObj<SpinnerComponent>;

export const Primary: Story = {
  args: {
    styleType: 'default',
  },
};

export const Circle: Story = {
  args: {
    styleType: 'circle',
  },
};

export const DualRing: Story = {
  args: {
    styleType: 'dual-ring',
  },
};

export const Hourglass: Story = {
  args: {
    styleType: 'hourglass',
  },
};

export const Dots: Story = {
  args: {
    styleType: 'dots',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/spinner works!/gi)).toBeTruthy();
  },
};
