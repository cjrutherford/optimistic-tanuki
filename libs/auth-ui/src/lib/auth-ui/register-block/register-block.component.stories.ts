import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterBlockComponent } from './register-block.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RegisterBlockComponent> = {
  component: RegisterBlockComponent,
  title: 'RegisterBlockComponent',
};
export default meta;
type Story = StoryObj<RegisterBlockComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/register-block works!/gi)).toBeTruthy();
  },
};
