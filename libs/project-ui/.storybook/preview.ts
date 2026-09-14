import { createPreview } from '../../../tools/storybook/preview';

export default createPreview({
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
});
