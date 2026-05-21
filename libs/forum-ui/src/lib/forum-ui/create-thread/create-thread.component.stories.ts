import type { Meta, StoryObj } from '@storybook/angular';
import { CreateThreadComponent } from './create-thread.component';
import { TopicDto } from '../models';

const meta: Meta<CreateThreadComponent> = {
    component: CreateThreadComponent,
    title: 'Forum UI/Create Thread',
    args: {
    }
};
export default meta;

type Story = StoryObj<CreateThreadComponent>;

const mockTopics: TopicDto[] = [
    {
        id: '1',
        name: 'General Discussion',
        description: 'Talk about anything',
        userId: 'user-1',
        profileId: 'profile-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        visibility: 'public',
        isPinned: false,
        isLocked: false,
    },
    {
        id: '2',
        name: 'Announcements',
        description: 'Important updates',
        userId: 'user-1',
        profileId: 'profile-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        visibility: 'public',
        isPinned: true,
        isLocked: true,
    }
];

export const Primary: Story = {
    args: {
        topics: mockTopics,
    },
};
