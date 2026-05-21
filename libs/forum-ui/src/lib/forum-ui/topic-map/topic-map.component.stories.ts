
import { Meta, StoryObj } from '@storybook/angular';
import { TopicMapComponent } from './topic-map.component';

const meta: Meta<TopicMapComponent> = {
    title: 'Forum UI/Topic Map',
    component: TopicMapComponent,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<TopicMapComponent>;

export const Default: Story = {
    args: {
        categories: [
            {
                id: '1',
                name: 'Development',
                count: 150,
                subtopics: [
                    { id: '1-1', name: 'Web', count: 80 },
                    { id: '1-2', name: 'Mobile', count: 40 },
                    { id: '1-3', name: 'DevOps', count: 30 },
                ],
            },
            {
                id: '2',
                name: 'Design',
                count: 80,
                subtopics: [
                    { id: '2-1', name: 'UI/UX', count: 50 },
                    { id: '2-2', name: 'Graphic Design', count: 30 },
                ],
            },
            {
                id: '3',
                name: 'General',
                count: 200,
                subtopics: [
                    { id: '3-1', name: 'Announcements', count: 20 },
                    { id: '3-2', name: 'Introductions', count: 180 },
                ],
            },
        ],
    },
};
