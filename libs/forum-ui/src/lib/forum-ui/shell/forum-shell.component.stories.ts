import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { ForumShellComponent } from './forum-shell.component';
import { ForumService } from '../services/forum.service';
import { AuthStateService } from '../services/auth-state.service';
import { ProfileService } from '../services/profile.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';

const mockTopics = [
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
];

const mockTopic = mockTopics[0];

const mockThreads = [
  {
    id: '1',
    title: 'Welcome',
    description: 'Welcome to the forum',
    userId: 'user-1',
    profileId: 'profile-1',
    topicId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    visibility: 'public',
    isPinned: true,
    isLocked: false,
    viewCount: 10
  }
];

const mockForumService = {
  getTopics: () => Promise.resolve(mockTopics),
  getTopic: (id: string) => Promise.resolve(mockTopic),
  getThreadsByTopic: (topicId: string) => Promise.resolve(mockThreads),
  getPostsByThread: (threadId: string) => Promise.resolve([]),
};

const mockAuthStateService = {
  getDecodedTokenValue: () => ({ sub: 'user-1', name: 'Test User' }),
  isLoggedIn: () => true,
  getCurrentUser: () => ({ sub: 'user-1', name: 'Test User' }),
};

const mockProfileService = {
  getCurrentUserProfile: () => ({
    id: 'profile-1',
    userId: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

const mockActivatedRoute = {
  params: of({}),
};

const meta: Meta<ForumShellComponent> = {
  component: ForumShellComponent,
  title: 'Forum UI/Shell',
  decorators: [
    applicationConfig({
      providers: [
        { provide: ForumService, useValue: mockForumService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: ProfileService, useValue: mockProfileService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }),
  ],
};
export default meta;

type Story = StoryObj<ForumShellComponent>;

export const Primary: Story = {
  args: {},
};
