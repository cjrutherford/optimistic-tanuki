import type { Preview } from '@storybook/angular';

const sampledPersonalities = [
    'classic',
    'minimal',
    'bold',
    'professional',
    'playful',
    'electric',
];

const preview: Preview = {
    globalTypes: {
        personalityId: {
            name: 'Personality',
            description: 'Design personality preset',
            defaultValue: 'classic',
            toolbar: {
                icon: 'paintbrush',
                items: sampledPersonalities,
            },
        },
        colorMode: {
            name: 'Mode',
            description: 'Theme mode',
            defaultValue: 'light',
            toolbar: {
                icon: 'mirror',
                items: ['light', 'dark'],
            },
        },
    },
    decorators: [],
};

export default preview;
