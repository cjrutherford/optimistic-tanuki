import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { ValidationBoardComponent } from './validation-board.component';

const meta: Meta<ValidationBoardComponent> = {
  component: ValidationBoardComponent,
  title: 'Playground/Validation Board',
  decorators: [
    applicationConfig({
      providers: [provideHttpClient(), provideRouter([])],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One representative component from each UI library. Switch the Personality and Mode toolbars to check every library against the same personality at once.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<ValidationBoardComponent>;

export const Board: Story = {};
