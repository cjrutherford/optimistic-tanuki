import type { Meta, StoryObj } from '@storybook/angular';
import { AgProjectJournalTableComponent } from './ag-project-journal-table.component';
import { ProjectJournal } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular';

const mockJournals: ProjectJournal[] = [
  {
    id: '1',
    projectId: 'project-1',
    profileId: 'profile-1',
    content: 'Initial project setup completed. This is a comprehensive entry that details all the steps taken during the initial setup phase of the project, including environment configuration, dependency installation, and initial scaffolding.',
    analysis: 'Project is on track with all initial milestones met. The team has demonstrated strong collaboration and technical competency. However, we should monitor the timeline closely as we approach the next phase.',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    updatedBy: 'admin',
  },
  {
    id: '2',
    projectId: 'project-1',
    profileId: 'profile-2',
    content: 'First sprint planning meeting held with the entire team. We discussed priorities, assigned initial tasks, and established our sprint cadence. The meeting was productive and everyone left with clear action items.',
    analysis: 'Team is aligned on goals and excited about the project direction. Communication channels are working well. Need to ensure we maintain this momentum throughout the sprint.',
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
    updatedBy: 'admin',
  },
  {
    id: '3',
    projectId: 'project-1',
    profileId: 'profile-1',
    content: 'Design phase completed with all wireframes and mockups approved by stakeholders.',
    analysis: 'Ready for development phase. All design assets are properly documented.',
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17'),
    updatedBy: 'admin',
  },
  {
    id: '4',
    projectId: 'project-1',
    profileId: 'profile-3',
    content: 'Backend API development progressing well. Most core endpoints are complete and tested.',
    analysis: 'Development is slightly ahead of schedule. Consider starting frontend integration early.',
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
    updatedBy: 'admin',
  },
];

const meta: Meta<AgProjectJournalTableComponent> = {
  component: AgProjectJournalTableComponent,
  title: 'Project UI/AG Grid Tables/Project Journal Table',
  decorators: [
    applicationConfig({
      providers: [provideHttpClient()],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AgProjectJournalTableComponent>;

export const Default: Story = {
  args: {
    journals: mockJournals,
  },
};

export const Empty: Story = {
  args: {
    journals: [],
  },
};

export const SingleEntry: Story = {
  args: {
    journals: [mockJournals[0]],
  },
};

export const ShortEntries: Story = {
  args: {
    journals: [
      {
        ...mockJournals[0],
        content: 'Short content entry.',
        analysis: 'Brief analysis.',
      },
      {
        ...mockJournals[1],
        content: 'Another short entry.',
        analysis: 'Quick note.',
      },
    ],
  },
};

export const LongEntries: Story = {
  args: {
    journals: [
      {
        ...mockJournals[0],
        content: 'This is an extremely long journal entry that contains extensive details about the project progress, technical decisions made, challenges encountered, and solutions implemented. It demonstrates how the table handles lengthy text content with wrapping and auto-height cells. The content continues to provide comprehensive documentation of the project activities and serves as a detailed record for future reference and audit purposes.',
        analysis: 'This analysis section is equally comprehensive, providing in-depth examination of the project status, risk assessment, team performance evaluation, and strategic recommendations. It showcases the tables ability to handle substantial text content while maintaining readability and proper formatting. The analysis continues with detailed insights and observations that are crucial for project stakeholders and decision makers.',
      },
    ],
  },
};
