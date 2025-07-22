import type { Meta, StoryObj } from '@storybook/angular';
import { HeadingComponent } from './heading.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<HeadingComponent> = {
  component: HeadingComponent,
  title: 'HeadingComponent',
};
export default meta;
type Story = StoryObj<HeadingComponent>;

export const Primary: Story = {
  args: {
    text: '',
    size: '1em',
  },
};

export const Heading: Story = {
  args: {
    text: '',
    size: '1em',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/heading works!/gi)).toBeTruthy();
  },
};
