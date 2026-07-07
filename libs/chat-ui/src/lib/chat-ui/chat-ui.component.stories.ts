import type { Meta, StoryObj } from '@storybook/angular';
import { ChatUiComponent } from './chat-ui.component';

const contacts = [
  {
    id: 'room-1',
    name: 'Design Review',
    profilePic: 'https://placehold.co/64x64?text=DR',
    lastMessage: 'Updated shell spacing is in the latest build.',
    lastMessageTime: '2026-07-06T13:15:00.000Z',
    presence: 'online' as const,
  },
  {
    id: 'room-2',
    name: 'Launch Ops',
    profilePic: 'https://placehold.co/64x64?text=LO',
    lastMessage: 'Need final copy before the banner goes live.',
    lastMessageTime: '2026-07-06T12:42:00.000Z',
    presence: 'away' as const,
  },
];

const conversations = [
  {
    id: 'room-1',
    participants: ['profile-me', 'profile-design'],
    messages: [
      {
        id: 'm1',
        conversationId: 'room-1',
        senderId: 'profile-design',
        recipientId: ['profile-me'],
        content: 'Updated shell spacing is in the latest build.',
        timestamp: new Date('2026-07-06T13:12:00.000Z'),
        type: 'chat' as const,
      },
      {
        id: 'm2',
        conversationId: 'room-1',
        senderId: 'profile-me',
        recipientId: ['profile-design'],
        content: 'Looks tighter. I am checking the empty state treatment now.',
        timestamp: new Date('2026-07-06T13:15:00.000Z'),
        type: 'chat' as const,
      },
    ],
    createdAt: new Date('2026-07-06T12:55:00.000Z'),
    updatedAt: new Date('2026-07-06T13:15:00.000Z'),
  },
  {
    id: 'room-2',
    participants: ['profile-me', 'profile-ops'],
    messages: [
      {
        id: 'm3',
        conversationId: 'room-2',
        senderId: 'profile-ops',
        recipientId: ['profile-me'],
        content: 'Need final copy before the banner goes live.',
        timestamp: new Date('2026-07-06T12:42:00.000Z'),
        type: 'chat' as const,
      },
    ],
    createdAt: new Date('2026-07-06T12:30:00.000Z'),
    updatedAt: new Date('2026-07-06T12:42:00.000Z'),
  },
];

const meta: Meta<ChatUiComponent> = {
  component: ChatUiComponent,
  title: 'Chat UI/Workspace',
  tags: ['autodocs'],
  args: {
    contacts,
    conversations,
    currentUserId: 'profile-me',
    autoOpenFirstConversation: true,
  },
};

export default meta;
type Story = StoryObj<ChatUiComponent>;

export const Embedded: Story = {
  args: {
    layout: 'embedded',
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export const Floating: Story = {
  args: {
    layout: 'floating',
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export const Empty: Story = {
  args: {
    layout: 'embedded',
    contacts: [],
    conversations: [],
    autoOpenFirstConversation: false,
  },
  parameters: {
    layout: 'fullscreen',
  },
};
