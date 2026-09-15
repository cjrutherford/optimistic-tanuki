import { setCompodocJson } from '@storybook/addon-docs/angular';
import { createPreview } from '../../../tools/storybook/preview';
import documentation from '../generated/documentation.json';

// Inputs, outputs, and descriptions for every component's Docs page.
setCompodocJson(documentation);

export default createPreview({
  tags: ['autodocs'],
  parameters: {
    options: {
      storySort: {
        order: [
          'Playground',
          ['Introduction', 'Validation Board'],
          'Docs',
          ['Overview', 'API Reference'],
          '*',
        ],
      },
    },
  },
});
