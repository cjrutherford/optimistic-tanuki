import type { Meta, StoryObj } from '@storybook/angular';
import { ProfileSelectorComponent } from './profile-selector.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ProfileDto } from '../models'; // Ensure this path is correct

const meta: Meta<ProfileSelectorComponent> = {
  component: ProfileSelectorComponent,
  title: 'ProfileSelectorComponent',
  argTypes: {
    selectedProfile: { action: 'selectedProfile' },
    profileCreated: { action: 'profileCreated' },
    profileUpdated: { action: 'profileUpdated' },
  },
};
export default meta;
type Story = StoryObj<ProfileSelectorComponent>;

const sampleProfiles: ProfileDto[] = [
  { 
    id: '1', 
    userId: 'u1',
    profileName: 'Alice Wonderland', 
    profilePic: 'https://placehold.co/100x100/AEC6CF/000000?text=AW', 
    coverPic: 'https://placehold.co/600x200/AEC6CF/000000?text=Cover+AW',
    bio: 'Curiouser and curiouser.',
    location: 'Wonderland',
    occupation: 'Explorer',
    interests: ['Adventures', 'Tea Parties'].join(','),
    skills: ['Curiosity', 'Bravery'].join(','),
    created_at: new Date(),
  },
  { 
    id: '2', 
    userId: 'u2',
    profileName: 'Bob The Builder', 
    profilePic: 'https://placehold.co/100x100/FFB347/000000?text=BB', 
    coverPic: 'https://placehold.co/600x200/FFB347/000000?text=Cover+BB',
    bio: 'Can we fix it? Yes, we can!',
    location: 'Sunflower Valley',
    occupation: 'Builder',
    interests: ['Building', 'Fixing'].join(','),
    skills: ['Construction', 'Problem Solving'].join(','),
    created_at: new Date(),
  },
  { 
    id: '3', 
    userId: 'u3',
    profileName: 'Charlie Brown', 
    profilePic: 'https://placehold.co/100x100/FDFD96/000000?text=CB', 
    coverPic: 'https://placehold.co/600x200/FDFD96/000000?text=Cover+CB',
    bio: 'Good grief. I love my dog Snoopy.',
    location: 'Peanuts Town',
    occupation: 'Student',
    interests: ['Baseball', 'Kite Flying'].join(','),
    skills: ['Perseverance', 'Friendship'].join(','),
    created_at: new Date(),
  },
  { 
    id: '4', 
    userId: 'u4',
    profileName: 'Diana Prince', 
    profilePic: 'https://placehold.co/100x100/FF6961/FFFFFF?text=DP', 
    coverPic: 'https://placehold.co/600x200/FF6961/FFFFFF?text=Cover+DP',
    bio: 'Wonder Woman from Themyscira.',
    location: 'Themyscira',
    occupation: 'Warrior',
    interests: ['Justice', 'Combat'].join(','),
    skills: ['Strength', 'Leadership'].join(','),
    created_at: new Date(),
  },
];

export const Primary: Story = {
  args: {
    profiles: sampleProfiles,
    currentSelectedProfile: null,
  },
};

export const WithProfileSelected: Story = {
  args: {
    profiles: sampleProfiles,
    currentSelectedProfile: sampleProfiles[1], // Bob is selected by input
  },
  play: async ({ canvasElement, component }) => {
    const canvas = within(canvasElement);
    // The component should internally set its signal based on currentSelectedProfile input.
    // If direct manipulation is needed for testing, it can be done via component instance.
    // For this story, we assume the component handles the input correctly.
    // We wait for potential async updates in the component.
    await new Promise(resolve => setTimeout(resolve, 0));

    const bobTile = canvas.getByText(/Bob The Builder/i).closest('.real-profile');
    expect(bobTile).not.toBeNull();
    if (bobTile) {
        expect(bobTile).toHaveClass('active');
    }
    // Check for the "Selected" button text within Bob's tile
    const selectedButton = within(bobTile as HTMLElement).getByText('Selected');
    expect(selectedButton).toBeTruthy();
  },
};

export const EmptyState: Story = {
  args: {
    profiles: [],
    currentSelectedProfile: null,
  },
};

export const Heading: Story = {
  args: {
    profiles: [sampleProfiles[0]], // Display with one profile
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Check for the main title of the component
    expect(canvas.getByText(/Your Profiles:/gi)).toBeTruthy();
    // Check if Alice's profile name is visible
    expect(canvas.getByText(/Alice Wonderland/gi)).toBeTruthy();
  },
};
