import type { Meta, StoryObj } from '@storybook/angular';
import { sampleNotes, sampleTasks } from '../project-ui.fixtures';
import { TaskNotesPanelComponent } from './task-notes-panel.component';

const meta: Meta<TaskNotesPanelComponent> = {
  component: TaskNotesPanelComponent,
  title: 'Tasks/Task Notes Panel',
  tags: ['autodocs'],
  args: {
    tasks: sampleTasks.map(({ id, title, status }) => ({ id, title, status })),
    notes: sampleNotes,
    savingTaskId: null,
  },
  argTypes: { noteAdded: { action: 'noteAdded' } },
};

export default meta;
type Story = StoryObj<TaskNotesPanelComponent>;

export const Notes: Story = {};
export const Saving: Story = { args: { savingTaskId: 'task-copy' } };
