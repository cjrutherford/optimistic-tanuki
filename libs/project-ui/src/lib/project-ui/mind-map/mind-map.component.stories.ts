import type { Meta, StoryObj } from '@storybook/angular';
import {
  sampleChanges,
  sampleRisks,
  sampleTasks,
} from '../project-ui.fixtures';
import { MindMapComponent } from './mind-map.component';

const meta: Meta<MindMapComponent> = {
  component: MindMapComponent,
  title: 'Planning/Mind Map',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    tasks: sampleTasks,
    risks: sampleRisks,
    changes: sampleChanges,
    projectId: 'project-launch',
  },
  argTypes: {
    nodeClick: { action: 'nodeClick' },
    nodeMove: { action: 'nodeMove' },
  },
};

export default meta;
type Story = StoryObj<MindMapComponent>;

export const Project: Story = {};
export const TasksOnly: Story = { args: { risks: [], changes: [] } };
