import type { Meta, StoryObj } from '@storybook/angular';
import { sampleNarrative, sampleProject } from '../project-ui.fixtures';
import { ProjectSummaryComponent } from './project-summary.component';

const meta: Meta<ProjectSummaryComponent> = {
  component: ProjectSummaryComponent,
  title: 'Planning/Project Summary',
  tags: ['autodocs'],
  args: {
    project: sampleProject,
    narrative: sampleNarrative,
    narrativeLoading: false,
  },
  argTypes: {
    entitySelected: { action: 'entitySelected' },
    narrativeRequested: { action: 'narrativeRequested' },
  },
};

export default meta;
type Story = StoryObj<ProjectSummaryComponent>;

export const WithNarrative: Story = {};
export const LoadingNarrative: Story = {
  args: { narrative: null, narrativeLoading: true },
};
export const NoNarrative: Story = { args: { narrative: null } };
