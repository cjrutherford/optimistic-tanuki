import type { Meta, StoryObj } from '@storybook/angular';
import { AgTasksTableComponent } from './ag-tasks-table.component';
import { Task } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular';

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Design Homepage',
    description: 'Create wireframes and mockups for the new homepage',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: 'Alice Johnson',
    projectId: 'project-1',
    dueDate: new Date('2024-12-31'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    title: 'Implement Login',
    description: 'Develop authentication module with JWT',
    status: 'TODO',
    priority: 'HIGH',
    assignee: 'Bob Smith',
    projectId: 'project-1',
    dueDate: new Date('2024-12-25'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-16'),
  },
  {
    id: '3',
    title: 'Set up Database',
    description: 'Initialize PostgreSQL instance and configure migrations',
    status: 'DONE',
    priority: 'MEDIUM',
    assignee: 'Charlie Brown',
    projectId: 'project-1',
    dueDate: new Date('2024-01-20'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-10'),
  },
  {
    id: '4',
    title: 'Write Tests',
    description: 'Add unit tests for user service',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    assignee: 'Dana White',
    projectId: 'project-1',
    dueDate: new Date('2024-12-28'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-17'),
  },
  {
    id: '5',
    title: 'Deploy to Staging',
    description: 'Deploy latest build to staging environment',
    status: 'TODO',
    priority: 'LOW',
    assignee: 'Eve Davis',
    projectId: 'project-1',
    dueDate: new Date('2025-01-05'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-18'),
  },
];

const meta: Meta<AgTasksTableComponent> = {
  component: AgTasksTableComponent,
  title: 'Project UI/AG Grid Tables/Tasks Table',
  decorators: [
    applicationConfig({
      providers: [provideHttpClient()],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AgTasksTableComponent>;

export const Default: Story = {
  args: {
    tasks: mockTasks,
  },
};

export const Empty: Story = {
  args: {
    tasks: [],
  },
};

export const SingleTask: Story = {
  args: {
    tasks: [mockTasks[0]],
  },
};

export const ManyTasks: Story = {
  args: {
    tasks: [
      ...mockTasks,
      ...mockTasks.map((task, index) => ({
        ...task,
        id: `${parseInt(task.id) + 5 + index}`,
        title: `${task.title} (Copy ${index + 1})`,
      })),
    ],
  },
};

export const AllStatuses: Story = {
  args: {
    tasks: [
      { ...mockTasks[0], status: 'TODO', title: 'TODO Task' },
      { ...mockTasks[1], status: 'IN_PROGRESS', title: 'In Progress Task' },
      { ...mockTasks[2], status: 'DONE', title: 'Done Task' },
      { ...mockTasks[3], status: 'IN_PROGRESS', title: 'Blocked Task' },
    ],
  },
};

export const AllPriorities: Story = {
  args: {
    tasks: [
      { ...mockTasks[0], priority: 'HIGH', title: 'Critical Priority' },
      { ...mockTasks[1], priority: 'HIGH', title: 'High Priority' },
      { ...mockTasks[2], priority: 'MEDIUM', title: 'Medium Priority' },
      { ...mockTasks[3], priority: 'LOW', title: 'Low Priority' },
    ],
  },
};
