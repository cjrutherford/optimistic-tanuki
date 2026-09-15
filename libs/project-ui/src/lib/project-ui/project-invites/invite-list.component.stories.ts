import type { Meta, StoryObj } from '@storybook/angular';
import { sampleInvites } from '../project-ui.fixtures';
import { ProjectInviteListComponent } from './invite-list.component';

const meta: Meta<ProjectInviteListComponent> = {
  component: ProjectInviteListComponent,
  title: 'Collaboration/Invite List',
  tags: ['autodocs'],
  args: { invites: sampleInvites },
  argTypes: { revoked: { action: 'revoked' } },
};

export default meta;
type Story = StoryObj<ProjectInviteListComponent>;

export const Invites: Story = {};
export const Empty: Story = { args: { invites: [] } };
