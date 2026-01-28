
import { Meta, StoryObj } from '@storybook/angular';
import { ForumPostComponent } from './post.component';
import { ForumPostDto } from '../models';

const meta: Meta<ForumPostComponent> = {
    title: 'Forum/Post',
    component: ForumPostComponent,
    tags: ['autodocs'],
    argTypes: {
        canEdit: { control: 'boolean' },
        canDelete: { control: 'boolean' },
        editClicked: { action: 'editClicked' },
        deleteClicked: { action: 'deleteClicked' },
    },
};

export default meta;
type Story = StoryObj<ForumPostComponent>;

const mockPost: ForumPostDto = {
    id: '1',
    content: 'This is a sample forum post content used for demonstration purposes in Storybook.',
    userId: 'user-123',
    profileId: 'profile-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    threadId: 'thread-1',
    isEdited: false,
};

export const Default: Story = {
    args: {
        post: mockPost,
        canEdit: false,
        canDelete: false,
    },
};

export const WithActions: Story = {
    args: {
        post: mockPost,
        canEdit: true,
        canDelete: true,
    },
};
