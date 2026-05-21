import type { Meta, StoryObj } from '@storybook/angular';
import { CreateTopicComponent } from './create-topic.component';

const meta: Meta<CreateTopicComponent> = {
    component: CreateTopicComponent,
    title: 'Forum UI/Create Topic',
    args: {
    }
};
export default meta;

type Story = StoryObj<CreateTopicComponent>;

export const Primary: Story = {
    args: {},
};
