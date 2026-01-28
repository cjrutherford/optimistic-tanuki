import type { Meta, StoryObj } from '@storybook/angular';
import { TopicComponent } from './topic.component';
import { expect } from 'storybook/test';
import { TopicDto } from '../models';

const meta: Meta<TopicComponent> = {
  component: TopicComponent,
  title: 'Forum UI/Topic',
};
export default meta;

type Story = StoryObj<TopicComponent>;

const mockTopic: TopicDto = {
  id: '1',
  name: 'General Discussion',
  description: 'A place to talk about anything and everything.',
  userId: 'user-1',
  profileId: 'profile-1',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  visibility: 'public',
  isPinned: false,
  isLocked: false,
};

export const Primary: Story = {
  args: {
    topic: mockTopic,
    canEdit: false,
    canDelete: false,
  },
};

export const Editable: Story = {
  args: {
    topic: mockTopic,
    canEdit: true,
    canDelete: true,
  },
};
