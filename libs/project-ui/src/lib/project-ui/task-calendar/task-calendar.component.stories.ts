import type { Meta, StoryObj } from '@storybook/angular';
import { sampleTasks } from '../project-ui.fixtures';
import { TaskCalendarComponent } from './task-calendar.component';

const meta: Meta<TaskCalendarComponent> = {
  component: TaskCalendarComponent,
  title: 'Tasks/Task Calendar',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { tasks: sampleTasks, loading: false },
  argTypes: {
    createTask: { action: 'createTask' },
    editTask: { action: 'editTask' },
    deleteTask: { action: 'deleteTask' },
    dateSelected: { action: 'dateSelected' },
    dateChanged: { action: 'dateChanged' },
  },
};

export default meta;
type Story = StoryObj<TaskCalendarComponent>;

export const Month: Story = {};
export const Loading: Story = { args: { tasks: [], loading: true } };
