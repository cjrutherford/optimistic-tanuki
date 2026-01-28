
import { applicationConfig } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';

export const decorators = [
    applicationConfig({
        providers: [provideAnimations()],
    }),
];

// Import global styles
import '!style-loader!css-loader!sass-loader!./theme-defaults.scss';
import '!style-loader!css-loader!sass-loader!../../theme-ui/src/lib/theme-ui/utilities.scss';
