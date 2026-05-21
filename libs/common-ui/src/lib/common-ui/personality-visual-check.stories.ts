import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button/button.component';

const meta: Meta<ButtonComponent> = {
    component: ButtonComponent,
    title: 'Theme Verification/Common UI',
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ButtonComponent>;

const renderButtonSet = () => ({
    template: `
    <div style="display:flex; gap:12px; flex-wrap:wrap; padding:16px; background: var(--background); color: var(--foreground); border: 1px solid var(--border); border-radius: var(--border-radius-md, 8px);">
      <otui-button variant="primary">Primary</otui-button>
      <otui-button variant="secondary">Secondary</otui-button>
      <otui-button variant="outlined">Outlined</otui-button>
      <otui-button variant="text">Text</otui-button>
    </div>
  `,
});

export const ClassicLight: Story = {
    render: renderButtonSet,
    parameters: {
        globals: {
            personalityId: 'classic',
            colorMode: 'light',
        },
    },
};

export const MinimalDark: Story = {
    render: renderButtonSet,
    parameters: {
        globals: {
            personalityId: 'minimal',
            colorMode: 'dark',
        },
    },
};

export const BoldLight: Story = {
    render: renderButtonSet,
    parameters: {
        globals: {
            personalityId: 'bold',
            colorMode: 'light',
        },
    },
};

export const PlayfulDark: Story = {
    render: renderButtonSet,
    parameters: {
        globals: {
            personalityId: 'playful',
            colorMode: 'dark',
        },
    },
};
