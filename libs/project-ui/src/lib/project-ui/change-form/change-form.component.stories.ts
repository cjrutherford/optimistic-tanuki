import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeFormComponent } from './change-form.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ChangeFormComponent> = {
  component: ChangeFormComponent,
  title: 'ChangeFormComponent',
};
export default meta;
type Story = StoryObj<ChangeFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/change-form works!/gi)).toBeTruthy();
  },
};
