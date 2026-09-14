import type { Meta, StoryObj } from '@storybook/angular';
import type {
  ProjectAnalytics,
  TagAnalytics,
} from '@optimistic-tanuki/ui-models';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';

const projectAnalytics: ProjectAnalytics = {
  projectId: 'project-launch',
  projectName: 'Site relaunch',
  totalTimeSeconds: 61200,
  taskCount: 5,
  tasks: [
    {
      taskId: 'task-copy',
      taskTitle: 'Write landing page copy',
      totalTimeSeconds: 25200,
      entryCount: 6,
      tags: ['Design'],
    },
    {
      taskId: 'task-api',
      taskTitle: 'Wire the booking API',
      totalTimeSeconds: 21600,
      entryCount: 4,
      tags: ['Backend'],
    },
    {
      taskId: 'task-analytics',
      taskTitle: 'Add privacy-friendly analytics',
      totalTimeSeconds: 14400,
      entryCount: 3,
      tags: ['Backend', 'Launch'],
    },
  ],
};

const tagAnalytics: TagAnalytics[] = [
  {
    tagId: 'tag-design',
    tagName: 'Design',
    totalTimeSeconds: 25200,
    taskCount: 1,
  },
  {
    tagId: 'tag-backend',
    tagName: 'Backend',
    totalTimeSeconds: 36000,
    taskCount: 2,
  },
  {
    tagId: 'tag-launch',
    tagName: 'Launch',
    totalTimeSeconds: 14400,
    taskCount: 1,
  },
];

const meta: Meta<AnalyticsDashboardComponent> = {
  component: AnalyticsDashboardComponent,
  title: 'Time/Analytics Dashboard',
  tags: ['autodocs'],
  args: { projectAnalytics, tagAnalytics },
};

export default meta;
type Story = StoryObj<AnalyticsDashboardComponent>;

export const WithData: Story = {};
export const NoData: Story = {
  args: { projectAnalytics: null, tagAnalytics: [] },
};
