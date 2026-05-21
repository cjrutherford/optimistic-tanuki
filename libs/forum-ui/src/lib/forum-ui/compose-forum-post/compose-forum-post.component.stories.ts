
import { Meta, StoryObj } from '@storybook/angular';
import { ComposeForumPostComponent } from './compose-forum-post.component';
import { moduleMetadata, applicationConfig } from '@storybook/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

const meta: Meta<ComposeForumPostComponent> = {
    title: 'Forum UI/Compose Forum Post',
    component: ComposeForumPostComponent,
    decorators: [
        applicationConfig({
            providers: [ThemeService]
        }),
        moduleMetadata({
            imports: [FormsModule, ReactiveFormsModule, TiptapEditorDirective],
        }),
    ],
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ComposeForumPostComponent>;

export const Default: Story = {
    args: {
        availableTopics: [
            { id: '1', name: 'General', description: 'General discussion', userId: '1', profileId: '1', createdAt: new Date(), updatedAt: new Date(), visibility: 'public', isPinned: false, isLocked: false },
        ],
        availableThreads: [],
    }
};
