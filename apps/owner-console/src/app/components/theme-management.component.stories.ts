import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ThemeManagementComponent } from './theme-management.component';
import { StorybookThemeBridgeComponent } from '@optimistic-tanuki/theme-lib';

const meta: Meta<ThemeManagementComponent> = {
    component: ThemeManagementComponent,
    title: 'Owner Console/Theme Management',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        moduleMetadata({
            imports: [StorybookThemeBridgeComponent],
        }),
        (story, context) => {
            const storyResult = story();
            return {
                ...storyResult,
                props: {
                    ...storyResult.props,
                    personalityId: context.globals['personalityId'] ?? 'classic',
                    mode: context.globals['colorMode'] ?? 'light',
                },
                template: `<lib-storybook-theme-bridge [personalityId]="personalityId" [mode]="mode">${storyResult.template ?? '<app-theme-management></app-theme-management>'}</lib-storybook-theme-bridge>`,
            };
        },
    ],
};

export default meta;
type Story = StoryObj<ThemeManagementComponent>;

export const Default: Story = {};

export const DarkMinimal: Story = {
    parameters: {
        globals: {
            personalityId: 'minimal',
            colorMode: 'dark',
        },
    },
};

export const ElectricLight: Story = {
    parameters: {
        globals: {
            personalityId: 'electric',
            colorMode: 'light',
        },
    },
};
