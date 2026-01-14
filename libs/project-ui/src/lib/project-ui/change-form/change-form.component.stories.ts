import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeFormComponent } from './change-form.component';
import { within, expect } from 'storybook/internal/test';

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
