import type { Meta, StoryObj } from '@storybook/angular';
import { samplePeople } from '../project-ui.fixtures';
import { ProjectMembersComponent } from './project-members.component';

const meta: Meta<ProjectMembersComponent> = {
  component: ProjectMembersComponent,
  title: 'Collaboration/Project Members',
  tags: ['autodocs'],
  args: {
    people: samplePeople,
    viewerProfileId: 'profile-mika',
    viewerIsOwner: true,
  },
  argTypes: { removed: { action: 'removed' }, left: { action: 'left' } },
};

export default meta;
type Story = StoryObj<ProjectMembersComponent>;

export const OwnerView: Story = {};
export const MemberView: Story = {
  args: { viewerProfileId: 'profile-ari', viewerIsOwner: false },
};
