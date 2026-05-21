
import { Meta, StoryObj } from '@storybook/angular';
import { TagCloudComponent } from './tag-cloud.component';

const meta: Meta<TagCloudComponent> = {
    title: 'Forum UI/Tag Cloud',
    component: TagCloudComponent,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<TagCloudComponent>;

export const Default: Story = {
    args: {
        tags: [
            { id: '1', label: 'Angular', count: 120 },
            { id: '2', label: 'React', count: 80 },
            { id: '3', label: 'Vue', count: 50 },
            { id: '4', label: 'TypeScript', count: 150 },
            { id: '5', label: 'JavaScript', count: 200 },
            { id: '6', label: 'HTML', count: 180 },
            { id: '7', label: 'CSS', count: 160 },
            { id: '8', label: 'SASS', count: 90 },
            { id: '9', label: 'RxJS', count: 70 },
            { id: '10', label: 'NgRx', count: 40 },
        ],
    },
};

export const Empty: Story = {
    args: {
        tags: [],
    },
};
