import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectInviteFormComponent } from './invite-form.component';

const meta: Meta<ProjectInviteFormComponent> = {
  component: ProjectInviteFormComponent,
  title: 'Collaboration/Invite Form',
  tags: ['autodocs'],
  args: { busy: false, error: null },
  argTypes: { invited: { action: 'invited' } },
};

export default meta;
type Story = StoryObj<ProjectInviteFormComponent>;

export const Default: Story = {};
export const Sending: Story = { args: { busy: true } };
export const Failed: Story = {
  args: { error: 'That person is already a member.' },
};
