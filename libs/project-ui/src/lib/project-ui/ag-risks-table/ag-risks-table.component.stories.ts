import type { Meta, StoryObj } from '@storybook/angular';
import { AgRisksTableComponent } from './ag-risks-table.component';
import { Risk } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular';

const mockRisks: Risk[] = [
  {
    id: '1',
    description: 'Database performance may degrade under high load',
    impact: 'HIGH',
    likelihood: 'LIKELY',
    projectId: 'project-1',
    status: 'OPEN',
    createdBy: 'admin',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    description: 'Third-party API dependency could become unavailable',
    impact: 'MEDIUM',
    likelihood: 'POSSIBLE',
    projectId: 'project-1',
    status: 'IN_PROGRESS',
    resolution: 'MITIGATED',
    createdBy: 'admin',
    createdAt: new Date('2024-01-16'),
  },
  {
    id: '3',
    description: 'Security vulnerability in authentication system',
    impact: 'HIGH',
    likelihood: 'UNLIKELY',
    projectId: 'project-1',
    status: 'OPEN',
    createdBy: 'admin',
    createdAt: new Date('2024-01-17'),
  },
  {
    id: '4',
    description: 'Team member unavailability during critical phase',
    impact: 'MEDIUM',
    likelihood: 'CERTAIN',
    projectId: 'project-1',
    status: 'IN_PROGRESS',
    resolution: 'ACCEPTED',
    createdBy: 'admin',
    createdAt: new Date('2024-01-18'),
  },
  {
    id: '5',
    description: 'Browser compatibility issues with older versions',
    impact: 'LOW',
    likelihood: 'POSSIBLE',
    projectId: 'project-1',
    status: 'CLOSED',
    createdBy: 'admin',
    createdAt: new Date('2024-01-19'),
  },
];

const meta: Meta<AgRisksTableComponent> = {
  component: AgRisksTableComponent,
  title: 'Project UI/AG Grid Tables/Risks Table',
  decorators: [
    applicationConfig({
      providers: [provideHttpClient()],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AgRisksTableComponent>;

export const Default: Story = {
  args: {
    risks: mockRisks,
  },
};

export const Empty: Story = {
  args: {
    risks: [],
  },
};

export const HighImpactRisks: Story = {
  args: {
    risks: mockRisks.filter((r) => r.impact === 'HIGH'),
  },
};

export const OpenRisks: Story = {
  args: {
    risks: mockRisks.filter((r) => r.status === 'OPEN'),
  },
};

export const AllImpactLevels: Story = {
  args: {
    risks: [
      { ...mockRisks[0], impact: 'HIGH', description: 'Critical Impact Risk' },
      { ...mockRisks[1], impact: 'HIGH', description: 'High Impact Risk' },
      { ...mockRisks[2], impact: 'MEDIUM', description: 'Medium Impact Risk' },
      { ...mockRisks[3], impact: 'LOW', description: 'Low Impact Risk' },
    ],
  },
};

export const AllLikelihoodLevels: Story = {
  args: {
    risks: [
      {
        ...mockRisks[0],
        likelihood: 'CERTAIN',
        description: 'Certain Likelihood',
      },
      {
        ...mockRisks[1],
        likelihood: 'LIKELY',
        description: 'Likely Likelihood',
      },
      {
        ...mockRisks[2],
        likelihood: 'POSSIBLE',
        description: 'Possible Likelihood',
      },
      {
        ...mockRisks[3],
        likelihood: 'UNLIKELY',
        description: 'Unlikely Likelihood',
      },
    ],
  },
};
