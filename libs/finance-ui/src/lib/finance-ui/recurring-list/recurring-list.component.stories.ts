import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '@optimistic-tanuki/finance-data-access';
import { RecurringListComponent } from './recurring-list.component';

const meta: Meta<RecurringListComponent> = {
  component: RecurringListComponent,
  title: 'Recurring Items',
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
type Story = StoryObj<RecurringListComponent>;

export const Default: Story = {};
