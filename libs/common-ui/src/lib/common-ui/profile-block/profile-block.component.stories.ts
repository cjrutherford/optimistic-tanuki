import type { Meta, StoryObj } from '@storybook/angular';
import { ProfileBlockComponent } from './profile-block.component';

const meta: Meta<ProfileBlockComponent> = {
  component: ProfileBlockComponent,
  title: 'Primitives/ProfileBlock',
  tags: ['autodocs'],
  args: {
    profileName: 'Ari Stone',
    profileImage: 'https://placehold.co/120x120/0f172a/e2e8f0?text=AS',
    bio: 'Developer experience lead with a bias toward polished internal tools.',
    actions: [
      { label: 'Message', callback: () => undefined },
      { label: 'Follow', callback: () => undefined },
    ],
  },
};

export default meta;
type Story = StoryObj<ProfileBlockComponent>;

export const Default: Story = {};

export const WithoutActions: Story = {
  args: { actions: [] },
};

export const WithoutImage: Story = {
  args: { profileImage: '' },
};
