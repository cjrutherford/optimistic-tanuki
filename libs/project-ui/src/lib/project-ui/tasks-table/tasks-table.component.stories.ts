import type { Meta, StoryObj } from '@storybook/angular';
import { TasksTableComponent } from './tasks-table.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<TasksTableComponent> = {
  component: TasksTableComponent,
  title: 'TasksTableComponent',
};
export default meta;
type Story = StoryObj<TasksTableComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/tasks-table works!/gi)).toBeTruthy();
  },
};
