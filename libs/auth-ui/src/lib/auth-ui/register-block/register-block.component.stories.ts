import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterBlockComponent } from './register-block.component';
import { expect, within } from '@storybook/test';

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
    await expect(canvas.getByText(/register-block works!/gi)).toBeTruthy();
  },
};
