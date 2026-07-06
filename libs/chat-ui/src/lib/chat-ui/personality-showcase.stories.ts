import type { Meta, StoryObj } from '@storybook/angular';
import { ChatUiComponent } from './chat-ui.component';

const meta: Meta<ChatUiComponent> = {
  component: ChatUiComponent,
  title: 'Chat UI/Personality Showcase',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<ChatUiComponent>;

export const Showcase: Story = {
  args: {
    layout: 'embedded',
    autoOpenFirstConversation: true,
    currentUserId: 'profile-me',
    contacts: [
      {
        id: 'studio',
        name: 'Studio Thread',
        profilePic: 'https://placehold.co/64x64?text=ST',
        lastMessage: 'Palette and shell treatment are ready for review.',
        lastMessageTime: '2026-07-06T14:12:00.000Z',
        presence: 'online',
      },
      {
        id: 'support',
        name: 'Support Queue',
        profilePic: 'https://placehold.co/64x64?text=SQ',
        lastMessage: 'Three customers are waiting on a handoff.',
        lastMessageTime: '2026-07-06T13:40:00.000Z',
        presence: 'busy',
      },
    ],
    conversations: [
      {
        id: 'studio',
        participants: ['profile-me', 'profile-studio'],
        messages: [
          {
            id: 'pm-1',
            conversationId: 'studio',
            senderId: 'profile-studio',
            recipientId: ['profile-me'],
            content: 'Palette and shell treatment are ready for review.',
            timestamp: new Date('2026-07-06T14:10:00.000Z'),
            type: 'chat',
          },
          {
            id: 'pm-2',
            conversationId: 'studio',
            senderId: 'profile-me',
            recipientId: ['profile-studio'],
            content:
              'Looks good. Checking how it behaves across personalities now.',
            timestamp: new Date('2026-07-06T14:12:00.000Z'),
            type: 'chat',
          },
        ],
        createdAt: new Date('2026-07-06T13:55:00.000Z'),
        updatedAt: new Date('2026-07-06T14:12:00.000Z'),
      },
      {
        id: 'support',
        participants: ['profile-me', 'profile-support'],
        messages: [
          {
            id: 'pm-3',
            conversationId: 'support',
            senderId: 'profile-support',
            recipientId: ['profile-me'],
            content: 'Three customers are waiting on a handoff.',
            timestamp: new Date('2026-07-06T13:40:00.000Z'),
            type: 'chat',
          },
        ],
        createdAt: new Date('2026-07-06T13:20:00.000Z'),
        updatedAt: new Date('2026-07-06T13:40:00.000Z'),
      },
    ],
  },
};
