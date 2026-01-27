import type { Meta, StoryObj } from '@storybook/angular';
import { ThreadComponent } from './thread.component';
import { expect } from 'storybook/test';
import { ThreadDto } from '../models';

const meta: Meta<ThreadComponent> = {
  component: ThreadComponent,
  title: 'Forum UI/Thread',
};
export default meta;

type Story = StoryObj<ThreadComponent>;

const mockThread: ThreadDto = {
  id: '1',
  title: 'Welcome to the Forum',
  description: 'This is a the main thread for introductions and general discussion.',
  userId: 'user-1',
  profileId: 'profile-1',
  topicId: 'topic-1',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-02'),
  visibility: 'public',
  isPinned: true,
  isLocked: false,
  viewCount: 1250,
};

export const Primary: Story = {
  args: {
    thread: mockThread,
    canEdit: false,
    canDelete: false,
  },
};

export const Editable: Story = {
  args: {
    thread: mockThread,
    canEdit: true,
    canDelete: true,
  },
};
