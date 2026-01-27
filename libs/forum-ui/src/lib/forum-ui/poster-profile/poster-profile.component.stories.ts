
import { Meta, StoryObj } from '@storybook/angular';
import { PosterProfileComponent } from './poster-profile.component';

const meta: Meta<PosterProfileComponent> = {
    title: 'Forum UI/Poster Profile',
    component: PosterProfileComponent,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PosterProfileComponent>;

export const Default: Story = {
    args: {
        poster: {
            id: '1',
            username: 'jdoe',
            displayName: 'John Doe',
            role: 'user',
            joinedAt: new Date('2023-01-15'),
        },
        stats: {
            postsCount: 120,
            topicsCount: 15,
            likesReceived: 350,
        },
    },
};

export const AdminNoStats: Story = {
    args: {
        poster: {
            id: '2',
            username: 'admin',
            displayName: 'Admin User',
            role: 'admin',
            joinedAt: new Date('2022-11-01'),
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        },
    },
};

export const Moderator: Story = {
    args: {
        poster: {
            id: '3',
            username: 'mod_jane',
            displayName: 'Jane Moderator',
            role: 'moderator',
            joinedAt: new Date('2023-03-20'),
        },
        stats: {
            postsCount: 540,
            topicsCount: 30,
            likesReceived: 1200,
        },
    },
};
