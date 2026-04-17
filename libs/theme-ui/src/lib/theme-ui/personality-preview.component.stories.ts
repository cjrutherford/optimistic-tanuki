import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityPreviewComponent } from './personality-preview.component';

const meta: Meta<PersonalityPreviewComponent> = {
    component: PersonalityPreviewComponent,
    title: 'Theme/Personality Preview',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
};

export default meta;
type Story = StoryObj<PersonalityPreviewComponent>;

export const Default: Story = {
    args: {
        showAllSections: true,
    },
};

export const MinimalDark: Story = {
    args: {
        showAllSections: true,
    },
    parameters: {
        globals: {
            personalityId: 'minimal',
            colorMode: 'dark',
        },
    },
};

export const ElectricLight: Story = {
    args: {
        showAllSections: true,
    },
    parameters: {
        globals: {
            personalityId: 'electric',
            colorMode: 'light',
        },
    },
};
