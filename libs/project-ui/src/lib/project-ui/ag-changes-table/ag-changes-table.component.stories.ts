import type { Meta, StoryObj } from '@storybook/angular';
import { AgChangesTableComponent } from './ag-changes-table.component';
import { Change } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular';

const mockChanges: Change[] = [
  {
    id: '1',
    changeDescription: 'Add new user authentication feature',
    changeType: 'ADDITION',
    changeStatus: 'PENDING',
    changeDate: new Date('2024-12-20'),
    requestor: 'Alice Johnson',
    approver: 'Bob Smith',
    resolution: 'PENDING',
    projectId: 'project-1',
    updatedBy: 'admin',
    updatedAt: new Date('2024-12-20'),
  },
  {
    id: '2',
    changeDescription: 'Modify database schema for performance',
    changeType: 'MODIFICATION',
    changeStatus: 'COMPLETE',
    changeDate: new Date('2024-12-18'),
    requestor: 'Charlie Brown',
    approver: 'Diana Prince',
    resolution: 'APPROVED',
    projectId: 'project-1',
    updatedBy: 'admin',
    updatedAt: new Date('2024-12-19'),
  },
  {
    id: '3',
    changeDescription: 'Remove deprecated API endpoints',
    changeType: 'DELETION',
    changeStatus: 'DISCARDED',
    changeDate: new Date('2024-12-15'),
    requestor: 'Eve Davis',
    approver: 'Frank Miller',
    resolution: 'REJECTED',
    projectId: 'project-1',
    updatedBy: 'admin',
    updatedAt: new Date('2024-12-16'),
  },
  {
    id: '4',
    changeDescription: 'Update frontend framework to latest version',
    changeType: 'MODIFICATION',
    changeStatus: 'COMPLETE',
    changeDate: new Date('2024-12-10'),
    requestor: 'Grace Lee',
    approver: 'Henry Wilson',
    resolution: 'APPROVED',
    projectId: 'project-1',
    updatedBy: 'admin',
    updatedAt: new Date('2024-12-12'),
  },
];

const meta: Meta<AgChangesTableComponent> = {
  component: AgChangesTableComponent,
  title: 'Project UI/AG Grid Tables/Changes Table',
  decorators: [
    applicationConfig({
      providers: [provideHttpClient()],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AgChangesTableComponent>;

export const Default: Story = {
  args: {
    changes: mockChanges,
  },
};

export const Empty: Story = {
  args: {
    changes: [],
  },
};

export const PendingChanges: Story = {
  args: {
    changes: mockChanges.filter((c) => c.resolution === 'PENDING'),
  },
};

export const ApprovedChanges: Story = {
  args: {
    changes: mockChanges.filter((c) => c.resolution === 'APPROVED'),
  },
};

export const AllChangeTypes: Story = {
  args: {
    changes: [
      {
        ...mockChanges[0],
        changeType: 'ADDITION',
        changeDescription: 'Addition Type',
      },
      {
        ...mockChanges[1],
        changeType: 'MODIFICATION',
        changeDescription: 'Modification Type',
      },
      {
        ...mockChanges[2],
        changeType: 'DELETION',
        changeDescription: 'Deletion Type',
      },
    ],
  },
};

export const AllResolutions: Story = {
  args: {
    changes: [
      {
        ...mockChanges[0],
        resolution: 'PENDING',
        changeDescription: 'Pending Resolution',
      },
      {
        ...mockChanges[1],
        resolution: 'APPROVED',
        changeDescription: 'Approved Resolution',
      },
      {
        ...mockChanges[2],
        resolution: 'REJECTED',
        changeDescription: 'Rejected Resolution',
      },
    ],
  },
};
