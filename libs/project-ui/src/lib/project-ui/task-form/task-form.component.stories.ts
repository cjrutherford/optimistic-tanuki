import type { Meta, StoryObj } from '@storybook/angular';
import { TaskFormComponent } from './task-form.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<TaskFormComponent> = {
  component: TaskFormComponent,
  title: 'TaskFormComponent',
};
export default meta;
type Story = StoryObj<TaskFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/task-form works!/gi)).toBeTruthy();
  },
};
