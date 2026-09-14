import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '../services';
import { SetupChecklistComponent } from './setup-checklist.component';

const meta: Meta<SetupChecklistComponent> = {
  component: SetupChecklistComponent,
  title: 'Setup Checklist',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([]),
        { provide: FinanceService, useClass: StoryFinanceService },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<SetupChecklistComponent>;

export const Default: Story = {};
