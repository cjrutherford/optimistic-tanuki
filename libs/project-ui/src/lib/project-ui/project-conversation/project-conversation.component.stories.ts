import type { Meta, StoryObj } from '@storybook/angular';
import { sampleMessages, samplePeople } from '../project-ui.fixtures';
import { ProjectConversationComponent } from './project-conversation.component';

const meta: Meta<ProjectConversationComponent> = {
  component: ProjectConversationComponent,
  title: 'Collaboration/Project Conversation',
  tags: ['autodocs'],
  args: {
    messages: sampleMessages,
    people: samplePeople,
    viewerProfileId: 'profile-ari',
    title: 'Site relaunch',
    unavailable: null,
  },
  argTypes: { sent: { action: 'sent' } },
};

export default meta;
type Story = StoryObj<ProjectConversationComponent>;

export const Conversation: Story = {};
export const Empty: Story = { args: { messages: [] } };
export const Unavailable: Story = {
  args: { unavailable: 'Messages could not be loaded.' },
};
