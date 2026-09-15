import type { Meta, StoryObj } from '@storybook/angular';
import { sampleTasks, sampleTimeEntries } from '../project-ui.fixtures';
import { TaskTimePanelComponent } from './task-time-panel.component';

const meta: Meta<TaskTimePanelComponent> = {
  component: TaskTimePanelComponent,
  title: 'Time/Task Time Panel',
  tags: ['autodocs'],
  args: {
    tasks: sampleTasks.map(({ id, title, status }) => ({ id, title, status })),
    entries: sampleTimeEntries,
    busyTaskId: null,
  },
  argTypes: {
    startTimer: { action: 'startTimer' },
    stopTimer: { action: 'stopTimer' },
  },
};

export default meta;
type Story = StoryObj<TaskTimePanelComponent>;

export const Tracking: Story = {};
export const Busy: Story = { args: { busyTaskId: 'task-analytics' } };
