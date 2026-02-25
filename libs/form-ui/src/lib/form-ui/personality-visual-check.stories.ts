import type { Meta, StoryObj } from '@storybook/angular';
import { TextInputComponent } from './text-input/text-input.component';

const meta: Meta<TextInputComponent> = {
    component: TextInputComponent,
    title: 'Theme Verification/Form UI',
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<TextInputComponent>;

const renderFormSet = () => ({
    template: `
    <div style="display:flex; flex-direction:column; gap:12px; max-width:420px; padding:16px; background: var(--background); color: var(--foreground); border: 1px solid var(--border); border-radius: var(--border-radius-md, 8px);">
      <lib-text-input label="Name" placeholder="Enter name" type="text"></lib-text-input>
      <lib-text-input label="Password" placeholder="Enter password" type="password"></lib-text-input>
    </div>
  `,
});

export const ClassicLight: Story = {
    render: renderFormSet,
    parameters: {
        globals: {
            personalityId: 'classic',
            colorMode: 'light',
        },
    },
};

export const ProfessionalDark: Story = {
    render: renderFormSet,
    parameters: {
        globals: {
            personalityId: 'professional',
            colorMode: 'dark',
        },
    },
};

export const ElectricLight: Story = {
    render: renderFormSet,
    parameters: {
        globals: {
            personalityId: 'electric',
            colorMode: 'light',
        },
    },
};

export const PlayfulDark: Story = {
    render: renderFormSet,
    parameters: {
        globals: {
            personalityId: 'playful',
            colorMode: 'dark',
        },
    },
};
