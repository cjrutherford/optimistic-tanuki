import type { Meta, StoryObj } from '@storybook/angular';
import { sampleTasks } from '../project-ui.fixtures';
import { TaskKanbanComponent } from './task-kanban.component';

const meta: Meta<TaskKanbanComponent> = {
  component: TaskKanbanComponent,
  title: 'Tasks/Task Kanban',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { tasks: sampleTasks, loading: false },
  argTypes: {
    createTask: { action: 'createTask' },
    editTask: { action: 'editTask' },
    deleteTask: { action: 'deleteTask' },
    statusChanged: { action: 'statusChanged' },
  },
};

export default meta;
type Story = StoryObj<TaskKanbanComponent>;

export const Board: Story = {};
export const Empty: Story = { args: { tasks: [] } };
export const Loading: Story = { args: { tasks: [], loading: true } };
