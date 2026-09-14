import type { Meta, StoryObj } from '@storybook/angular';
import { sampleTimeEntries } from '../project-ui.fixtures';
import { TimeTrackerComponent } from './time-tracker.component';

const meta: Meta<TimeTrackerComponent> = {
  component: TimeTrackerComponent,
  title: 'Time/Time Tracker',
  tags: ['autodocs'],
  args: {
    taskId: 'task-analytics',
    timeEntries: sampleTimeEntries,
    busy: false,
  },
  argTypes: {
    startTimer: { action: 'startTimer' },
    stopTimer: { action: 'stopTimer' },
  },
};

export default meta;
type Story = StoryObj<TimeTrackerComponent>;

export const Running: Story = {};
export const Stopped: Story = { args: { taskId: 'task-copy' } };
export const NoEntries: Story = { args: { timeEntries: [] } };
